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
import {
  usePlannerDispatch,
  usePlannerHydrated,
  usePlannerNotes,
  usePlannerTasks,
} from '../store/PlannerContext';
import {
  fetchCloudPlannerSnapshot,
  pushCloudPlannerMutations,
} from '../services/sync/cloudPlanner';
import { diffPlannerData, mergePlannerSnapshots } from '../services/sync/merge';
import {
  clearSyncOutbox,
  enqueueSyncMutations,
  readSyncOutbox,
  removeProcessedSyncMutations,
} from '../services/sync/outbox';
import { supabase } from '../services/supabase';
import type { Note, Task } from '../types';

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
  status: CloudSyncStatus;
  syncNow: () => Promise<void>;
}

interface PlannerSnapshot {
  notes: Note[];
  ownerId: string | null;
  tasks: Task[];
}

const RETRY_DELAY_MS = 15_000;
const CACHE_OWNER_STORAGE_KEY = '@planly/sync/cache-owner/v1';

const CloudSyncContext = createContext<CloudSyncContextValue | undefined>(
  undefined,
);

function samePlannerData(
  leftTasks: Task[],
  leftNotes: Note[],
  rightTasks: Task[],
  rightNotes: Note[],
): boolean {
  return (
    JSON.stringify(leftTasks) === JSON.stringify(rightTasks) &&
    JSON.stringify(leftNotes) === JSON.stringify(rightNotes)
  );
}

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { configured, hydrated: authHydrated, user } = useAuth();
  const hydrated = usePlannerHydrated();
  const tasks = usePlannerTasks();
  const notes = usePlannerNotes();
  const dispatch = usePlannerDispatch();
  const [status, setStatus] = useState<CloudSyncStatus>(
    configured ? 'signedOut' : 'disabled',
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [preparedOwnerId, setPreparedOwnerId] = useState<
    string | null | undefined
  >(configured ? undefined : null);
  const latestTasksRef = useRef(tasks);
  const latestNotesRef = useRef(notes);
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
  const syncNowRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    latestTasksRef.current = tasks;
    latestNotesRef.current = notes;
    latestUserIdRef.current = user?.id ?? null;
    preparedOwnerIdRef.current = preparedOwnerId;
  }, [notes, preparedOwnerId, tasks, user?.id]);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current === undefined) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = undefined;
  }, []);

  const performSync = useCallback(async () => {
    const userId = latestUserIdRef.current;
    if (
      !supabase ||
      !userId ||
      !hydrated ||
      preparedOwnerIdRef.current !== userId
    ) return;

    clearRetry();
    if (mountedRef.current) setStatus('syncing');

    try {
      const [remote, queuedMutations] = await Promise.all([
        fetchCloudPlannerSnapshot(supabase, userId),
        readSyncOutbox(userId),
      ]);
      if (latestUserIdRef.current !== userId) return;

      const currentTasks = latestTasksRef.current;
      const currentNotes = latestNotesRef.current;
      const merged = mergePlannerSnapshots(
        currentTasks,
        currentNotes,
        remote,
        queuedMutations,
      );

      if (
        !samePlannerData(
          currentTasks,
          currentNotes,
          merged.tasks,
          merged.notes,
        )
      ) {
        applyingCloudDataRef.current = true;
        dispatch({
          type: 'replace_from_sync',
          payload: { notes: merged.notes, tasks: merged.tasks },
        });
      }

      await pushCloudPlannerMutations(
        supabase,
        userId,
        merged.mutationsToPush,
      );
      if (latestUserIdRef.current !== userId) return;

      const remaining = await removeProcessedSyncMutations(
        merged.consumedMutations,
      );
      const remainingForUser = remaining.filter(
        (mutation) => mutation.ownerId === userId,
      );
      if (!mountedRef.current) return;
      setPendingCount(remainingForUser.length);
      setLastSyncedAt(new Date().toISOString());
      setStatus(remainingForUser.length > 0 ? 'pending' : 'synced');
      if (remainingForUser.length > 0) rerunRequestedRef.current = true;
    } catch {
      if (!mountedRef.current || latestUserIdRef.current !== userId) return;
      const queued = await readSyncOutbox(userId);
      if (!mountedRef.current) return;
      setPendingCount(queued.length);
      setStatus('error');
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = undefined;
        void syncNowRef.current();
      }, RETRY_DELAY_MS);
    }
  }, [clearRetry, dispatch, hydrated]);

  const syncNow = useCallback(async () => {
    if (
      !configured ||
      !latestUserIdRef.current ||
      !hydrated ||
      preparedOwnerIdRef.current !== latestUserIdRef.current
    ) return;
    if (runningRef.current) {
      rerunRequestedRef.current = true;
      return;
    }

    runningRef.current = true;
    try {
      do {
        rerunRequestedRef.current = false;
        await performSync();
      } while (rerunRequestedRef.current && latestUserIdRef.current);
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

  useEffect(() => {
    if (!hydrated) return;
    const ownerId = user?.id ?? null;
    const previous = previousSnapshotRef.current;

    if (applyingCloudDataRef.current) {
      applyingCloudDataRef.current = false;
      previousSnapshotRef.current = { notes, ownerId, tasks };
      return;
    }

    if (!previous || previous.ownerId !== ownerId) {
      previousSnapshotRef.current = { notes, ownerId, tasks };
      return;
    }

    previousSnapshotRef.current = { notes, ownerId, tasks };
    if (!ownerId || preparedOwnerId !== ownerId) return;

    const mutations = diffPlannerData(
      previous.tasks,
      previous.notes,
      tasks,
      notes,
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
  }, [hydrated, notes, preparedOwnerId, tasks, user?.id]);

  useEffect(() => {
    if (!authHydrated || !hydrated) return;
    if (!configured) return;

    const userId = user?.id ?? null;
    let active = true;
    void AsyncStorage.getItem(CACHE_OWNER_STORAGE_KEY).then(
      async (cachedOwnerId) => {
        if (!active || latestUserIdRef.current !== userId) return;

        if (!userId) {
          if (cachedOwnerId) {
            applyingCloudDataRef.current = true;
            dispatch({
              type: 'replace_from_sync',
              payload: { notes: [], tasks: [] },
            });
            await Promise.all([
              AsyncStorage.removeItem(CACHE_OWNER_STORAGE_KEY),
              clearSyncOutbox(),
            ]);
          }
          if (active) {
            clearRetry();
            setLastSyncedAt(null);
            setPendingCount(0);
            setPreparedOwnerId(null);
            setStatus('signedOut');
          }
          return;
        }

        if (cachedOwnerId && cachedOwnerId !== userId) {
          applyingCloudDataRef.current = true;
          dispatch({
            type: 'replace_from_sync',
            payload: { notes: [], tasks: [] },
          });
        }
        await AsyncStorage.setItem(CACHE_OWNER_STORAGE_KEY, userId);
        if (active && latestUserIdRef.current === userId) {
          setPreparedOwnerId(userId);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [authHydrated, clearRetry, configured, dispatch, hydrated, user?.id]);

  useEffect(() => {
    if (!configured || !authHydrated || !hydrated || !user) return;
    if (preparedOwnerId !== user.id) return;

    void readSyncOutbox(user.id).then((queued) => {
      if (mountedRef.current) setPendingCount(queued.length);
    });
    void syncNow();
  }, [authHydrated, configured, hydrated, preparedOwnerId, syncNow, user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncNowRef.current();
    });
    return () => subscription.remove();
  }, []);

  const value = useMemo<CloudSyncContextValue>(
    () => ({ lastSyncedAt, pendingCount, status, syncNow }),
    [lastSyncedAt, pendingCount, status, syncNow],
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
