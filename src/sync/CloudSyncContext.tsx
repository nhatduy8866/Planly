import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../auth/AuthContext';
import { usePreferences } from '../preferences/PreferencesContext';
import {
  usePlannerDispatch,
  usePlannerHydrated,
  usePersistPlannerTasks,
  usePlannerTasks,
} from '../store/PlannerContext';
import { SYNC_CACHE_OWNER_STORAGE_KEY } from '../storage/keys';
import {
  fetchCloudPlannerSnapshot,
  pushCloudPlannerMutations,
} from '../services/sync/cloudPlanner';
import { diffPlannerData, mergePlannerSnapshots } from '../services/sync/merge';
import {
  enqueueSyncMutations,
  readSyncOutbox,
  removeProcessedSyncMutations,
} from '../services/sync/outbox';
import { supabase } from '../services/supabase';
import type { Task } from '../types';
import { haveSameTaskLists } from '../utils/taskEquality';
import {
  clearLocalPlanlyData,
  type LocalDataCleanupMode,
} from '../services/localDataCleanup';

export type CloudSyncStatus =
  | 'disabled'
  | 'signedOut'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error';

interface CloudSyncContextValue {
  lastSyncedAt: string | null;
  pendingCount: number;
  ready: boolean;
  status: CloudSyncStatus;
  syncNow: () => Promise<CloudSyncStatus | undefined>;
}

interface PlannerSnapshot {
  ownerId: string | null;
  tasks: Task[];
}

const RETRY_DELAY_MS = 15_000;

const CloudSyncContext = createContext<CloudSyncContextValue | undefined>(
  undefined,
);

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const {
    configured,
    hydrated: authHydrated,
    registerLocalDataCleanup,
    user,
  } = useAuth();
  const { language, resetPreferences, theme } = usePreferences();
  const hydrated = usePlannerHydrated();
  const tasks = usePlannerTasks();
  const dispatch = usePlannerDispatch();
  const persistTasksNow = usePersistPlannerTasks();
  const [status, setStatus] = useState<CloudSyncStatus>(
    configured ? 'signedOut' : 'disabled',
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [preparedOwnerId, setPreparedOwnerId] = useState<
    string | null | undefined
  >(configured ? undefined : null);
  const latestTasksRef = useRef(tasks);
  const latestUserIdRef = useRef<string | null>(user?.id ?? null);
  const preparedOwnerIdRef = useRef<string | null | undefined>(
    preparedOwnerId,
  );
  const previousSnapshotRef = useRef<PlannerSnapshot | null>(null);
  const applyingCloudDataRef = useRef(false);
  const runningRef = useRef(false);
  const rerunRequestedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const mountedRef = useRef(true);
  const ownerTransitionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const ownerTransitionGenerationRef = useRef(0);
  const syncNowRef = useRef<() => Promise<CloudSyncStatus | undefined>>(
    async () => undefined,
  );

  useEffect(() => {
    latestTasksRef.current = tasks;
    latestUserIdRef.current = user?.id ?? null;
    preparedOwnerIdRef.current = preparedOwnerId;
  }, [preparedOwnerId, tasks, user?.id]);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current === undefined) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = undefined;
  }, []);

  const enqueueOwnerTransition = useCallback(<T,>(work: () => Promise<T>) => {
    const result = ownerTransitionQueueRef.current
      .catch(() => undefined)
      .then(work);
    ownerTransitionQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const clearLocalData = useCallback(async (mode: LocalDataCleanupMode) => {
    await clearLocalPlanlyData({
      language,
      mode,
      persistTasks: async (nextTasks) => {
        await persistTasksNow(nextTasks);
        applyingCloudDataRef.current = true;
        dispatch({
          type: 'replace_from_sync',
          payload: { tasks: nextTasks },
        });
      },
      resetPreferences,
      tasks: latestTasksRef.current,
      theme,
    });
  }, [dispatch, language, persistTasksNow, resetPreferences, theme]);

  const performSync = useCallback(async () => {
    const userId = latestUserIdRef.current;
    if (
      !supabase ||
      !userId ||
      !hydrated ||
      preparedOwnerIdRef.current !== userId
    ) return undefined;

    clearRetry();
    if (mountedRef.current) setStatus('syncing');

    try {
      const [remote, queuedMutations] = await Promise.all([
        fetchCloudPlannerSnapshot(supabase, userId),
        readSyncOutbox(userId),
      ]);
      if (
        latestUserIdRef.current !== userId ||
        preparedOwnerIdRef.current !== userId
      ) return;

      const currentTasks = latestTasksRef.current;
      const merged = mergePlannerSnapshots(
        currentTasks,
        remote,
        queuedMutations,
      );

      if (!haveSameTaskLists(currentTasks, merged.tasks)) {
        applyingCloudDataRef.current = true;
        dispatch({
          type: 'replace_from_sync',
          payload: { tasks: merged.tasks },
        });
      }

      await pushCloudPlannerMutations(
        supabase,
        userId,
        merged.mutationsToPush,
      );
      if (
        latestUserIdRef.current !== userId ||
        preparedOwnerIdRef.current !== userId
      ) return;

      const remaining = await removeProcessedSyncMutations(
        merged.consumedMutations,
      );
      const remainingForUser = remaining.filter(
        (mutation) => mutation.ownerId === userId,
      );
      if (
        !mountedRef.current ||
        latestUserIdRef.current !== userId ||
        preparedOwnerIdRef.current !== userId
      ) return;
      setPendingCount(remainingForUser.length);
      setLastSyncedAt(new Date().toISOString());
      const nextStatus = remainingForUser.length > 0 ? 'pending' : 'synced';
      setStatus(nextStatus);
      if (remainingForUser.length > 0) rerunRequestedRef.current = true;
      return nextStatus;
    } catch {
      if (
        !mountedRef.current ||
        latestUserIdRef.current !== userId ||
        preparedOwnerIdRef.current !== userId
      ) {
        return undefined;
      }
      const queued = await readSyncOutbox(userId);
      if (
        !mountedRef.current ||
        latestUserIdRef.current !== userId ||
        preparedOwnerIdRef.current !== userId
      ) return undefined;
      setPendingCount(queued.length);
      setStatus('error');
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = undefined;
        void syncNowRef.current();
      }, RETRY_DELAY_MS);
      return 'error';
    }
  }, [clearRetry, dispatch, hydrated]);

  const syncNow = useCallback(async () => {
    if (
      !configured ||
      !latestUserIdRef.current ||
      !hydrated ||
      preparedOwnerIdRef.current !== latestUserIdRef.current
    ) return undefined;
    if (runningRef.current) {
      rerunRequestedRef.current = true;
      return undefined;
    }

    runningRef.current = true;
    try {
      let result: CloudSyncStatus | undefined;
      do {
        rerunRequestedRef.current = false;
        result = await performSync();
      } while (rerunRequestedRef.current && latestUserIdRef.current);
      return result;
    } finally {
      runningRef.current = false;
    }
  }, [configured, hydrated, performSync]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRetry();
    };
  }, [clearRetry]);

  useEffect(() => registerLocalDataCleanup(async (mode) => {
    const generation = ownerTransitionGenerationRef.current + 1;
    const cleanupOwnerId = latestUserIdRef.current;
    ownerTransitionGenerationRef.current = generation;
    preparedOwnerIdRef.current = undefined;
    setPreparedOwnerId(undefined);
    clearRetry();
    await enqueueOwnerTransition(() => clearLocalData(mode));
    if (
      !mountedRef.current ||
      ownerTransitionGenerationRef.current !== generation ||
      latestUserIdRef.current !== cleanupOwnerId
    ) return;
    setLastSyncedAt(null);
    setPendingCount(0);
    preparedOwnerIdRef.current = null;
    setPreparedOwnerId(null);
    setStatus('signedOut');
  }), [
    clearLocalData,
    clearRetry,
    enqueueOwnerTransition,
    registerLocalDataCleanup,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const ownerId = user?.id ?? null;
    const previous = previousSnapshotRef.current;

    if (applyingCloudDataRef.current) {
      applyingCloudDataRef.current = false;
      previousSnapshotRef.current = { ownerId, tasks };
      return;
    }

    if (!previous || previous.ownerId !== ownerId) {
      previousSnapshotRef.current = { ownerId, tasks };
      return;
    }

    previousSnapshotRef.current = { ownerId, tasks };
    if (!ownerId || preparedOwnerId !== ownerId) return;

    const mutations = diffPlannerData(
      previous.tasks,
      tasks,
      undefined,
      ownerId,
    );
    if (mutations.length === 0) return;

    void enqueueSyncMutations(mutations).then((queued) => {
      if (!mountedRef.current || latestUserIdRef.current !== ownerId) return;
      setPendingCount(
        queued.filter((mutation) => mutation.ownerId === ownerId).length,
      );
      setStatus('pending');
      void syncNowRef.current();
    });
  }, [hydrated, preparedOwnerId, tasks, user?.id]);

  useEffect(() => {
    if (!authHydrated || !hydrated) return;
    if (!configured) return;

    const userId = user?.id ?? null;
    const generation = ownerTransitionGenerationRef.current + 1;
    ownerTransitionGenerationRef.current = generation;
    let active = true;
    preparedOwnerIdRef.current = undefined;
    setPreparedOwnerId(undefined);
    void enqueueOwnerTransition(async () => {
      const cachedOwnerId = await AsyncStorage.getItem(
        SYNC_CACHE_OWNER_STORAGE_KEY,
      );
      if (
        !active ||
        ownerTransitionGenerationRef.current !== generation ||
        latestUserIdRef.current !== userId
      ) return;

      if (!userId) {
        if (cachedOwnerId) {
          await clearLocalData('signOut');
        }
        if (
          !active ||
          ownerTransitionGenerationRef.current !== generation ||
          latestUserIdRef.current !== null
        ) return;
        clearRetry();
        setLastSyncedAt(null);
        setPendingCount(0);
        preparedOwnerIdRef.current = null;
        setPreparedOwnerId(null);
        setStatus('signedOut');
        return;
      }

      if (cachedOwnerId && cachedOwnerId !== userId) {
        await clearLocalData('signOut');
      }
      if (
        !active ||
        ownerTransitionGenerationRef.current !== generation ||
        latestUserIdRef.current !== userId
      ) return;

      await AsyncStorage.setItem(SYNC_CACHE_OWNER_STORAGE_KEY, userId);
      if (
        active &&
        ownerTransitionGenerationRef.current === generation &&
        latestUserIdRef.current === userId
      ) {
        preparedOwnerIdRef.current = userId;
        setPreparedOwnerId(userId);
      }
    }).catch(() => {
      if (
        active &&
        ownerTransitionGenerationRef.current === generation &&
        latestUserIdRef.current === userId
      ) {
        setStatus('error');
      }
    });

    return () => {
      active = false;
    };
  }, [
    authHydrated,
    clearLocalData,
    clearRetry,
    configured,
    enqueueOwnerTransition,
    hydrated,
    user?.id,
  ]);

  useEffect(() => {
    if (!configured || !authHydrated || !hydrated || !user) return;
    if (preparedOwnerId !== user.id) return;

    void readSyncOutbox(user.id).then((queued) => {
      if (
        mountedRef.current &&
        latestUserIdRef.current === user.id &&
        preparedOwnerIdRef.current === user.id
      ) setPendingCount(queued.length);
    });
    void syncNow();
  }, [authHydrated, configured, hydrated, preparedOwnerId, syncNow, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncNowRef.current();
    });
    return () => subscription.remove();
  }, []);

  const ready = !configured || (
    authHydrated &&
    hydrated &&
    preparedOwnerId === (user?.id ?? null)
  );
  const value = useMemo<CloudSyncContextValue>(
    () => ({ lastSyncedAt, pendingCount, ready, status, syncNow }),
    [lastSyncedAt, pendingCount, ready, status, syncNow],
  );

  return (
    <CloudSyncContext.Provider value={value}>
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSync(): CloudSyncContextValue {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error('useCloudSync must be used inside CloudSyncProvider');
  }
  return context;
}
