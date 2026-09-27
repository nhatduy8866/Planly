import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import type { PlannerState, Task } from '../types';
import {
  LEGACY_PLANNER_STORAGE_KEY,
  TASKS_STORAGE_KEY,
} from '../storage/keys';
import {
  initialPlannerState,
  plannerReducer,
  type PlannerAction,
} from './plannerReducer';

const PERSISTENCE_DEBOUNCE_MS = 300;

const PlannerTasksContext = createContext<Task[] | undefined>(undefined);
const PlannerHydratedContext = createContext<boolean | undefined>(undefined);
const PlannerDispatchContext = createContext<Dispatch<PlannerAction> | undefined>(
  undefined,
);
const PlannerPersistenceContext = createContext<
  ((tasks: Task[]) => Promise<void>) | undefined
>(undefined);

function normalizeStoredTask(task: Task): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    date: task.date,
    startTime: task.startTime,
    notificationId: task.notificationId,
    batchId: task.batchId,
    completed: task.completed,
    order: task.order,
    priority: task.priority,
    color: task.color,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function parseStoredArray<T>(raw: string | null): T[] | undefined {
  if (raw === null) return undefined;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : undefined;
  } catch {
    return undefined;
  }
}

function parseLegacyState(raw: string | null): Partial<PlannerState> {
  if (raw === null) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Partial<PlannerState>)
      : {};
  } catch {
    return {};
  }
}

function useDebouncedStorageWrite<T>(
  key: string,
  value: T,
  enabled: boolean,
): (nextValue: T) => Promise<void> {
  const latestValueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const writeValue = useCallback((nextValue: T): Promise<void> => {
    let serialized: string;
    try {
      serialized = JSON.stringify(nextValue);
    } catch (error) {
      return Promise.reject(error);
    }

    const nextWrite = writeQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(key, serialized));
    writeQueueRef.current = nextWrite.catch(() => undefined);
    return nextWrite;
  }, [key]);

  const persistNow = useCallback((nextValue: T): Promise<void> => {
    latestValueRef.current = nextValue;
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    return writeValue(nextValue);
  }, [writeValue]);

  const flush = useCallback(() => {
    if (!enabled) return;
    void persistNow(latestValueRef.current).catch(() => undefined);
  }, [enabled, persistNow]);

  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setTimeout(flush, PERSISTENCE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [enabled, flush, value]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') flush();
    });

    return () => {
      subscription.remove();
      flush();
    };
  }, [enabled, flush]);

  return persistNow;
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const [tasksRaw, legacyRaw] = await Promise.all([
          AsyncStorage.getItem(TASKS_STORAGE_KEY),
          AsyncStorage.getItem(LEGACY_PLANNER_STORAGE_KEY),
        ]);
        const legacy = parseLegacyState(legacyRaw);
        const storedTasks =
          parseStoredArray<Task>(tasksRaw) ??
          (Array.isArray(legacy.tasks) ? legacy.tasks : []);
        const cleanTasks = storedTasks
          .filter(
            (task) =>
              typeof task?.id === 'string' &&
              !task.id.startsWith('perf-mock-task-'),
          )
          .map(normalizeStoredTask);

        if (active) {
          dispatch({
            type: 'hydrate',
            payload: { tasks: cleanTasks },
          });
        }
      } catch {
        if (active) {
          dispatch({ type: 'hydrate', payload: { tasks: [] } });
        }
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const persistTasksNow = useDebouncedStorageWrite(
    TASKS_STORAGE_KEY,
    state.tasks,
    state.hydrated,
  );

  return (
    <PlannerHydratedContext.Provider value={state.hydrated}>
      <PlannerPersistenceContext.Provider value={persistTasksNow}>
        <PlannerDispatchContext.Provider value={dispatch}>
          <PlannerTasksContext.Provider value={state.tasks}>
            {children}
          </PlannerTasksContext.Provider>
        </PlannerDispatchContext.Provider>
      </PlannerPersistenceContext.Provider>
    </PlannerHydratedContext.Provider>
  );
}

export function usePlannerTasks(): Task[] {
  const tasks = useContext(PlannerTasksContext);
  if (!tasks) {
    throw new Error('usePlannerTasks must be used inside PlannerProvider');
  }
  return tasks;
}

export function usePlannerHydrated(): boolean {
  const hydrated = useContext(PlannerHydratedContext);
  if (hydrated === undefined) {
    throw new Error('usePlannerHydrated must be used inside PlannerProvider');
  }
  return hydrated;
}

export function usePlannerDispatch(): Dispatch<PlannerAction> {
  const dispatch = useContext(PlannerDispatchContext);
  if (!dispatch) {
    throw new Error('usePlannerDispatch must be used inside PlannerProvider');
  }
  return dispatch;
}

export function usePersistPlannerTasks(): (tasks: Task[]) => Promise<void> {
  const persistTasks = useContext(PlannerPersistenceContext);
  if (!persistTasks) {
    throw new Error('usePersistPlannerTasks must be used inside PlannerProvider');
  }
  return persistTasks;
}
