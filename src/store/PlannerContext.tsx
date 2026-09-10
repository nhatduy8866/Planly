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

import type { Note, PlannerState, Task } from '../types';
import {
  initialPlannerState,
  plannerReducer,
  type PlannerAction,
} from './plannerReducer';

const LEGACY_STORAGE_KEY = '@planly/planner/v1';
const TASKS_STORAGE_KEY = '@planly/tasks/v1';
const NOTES_STORAGE_KEY = '@planly/notes/v1';
const PERSISTENCE_DEBOUNCE_MS = 300;

const PlannerTasksContext = createContext<Task[] | undefined>(undefined);
const PlannerNotesContext = createContext<Note[] | undefined>(undefined);
const PlannerHydratedContext = createContext<boolean | undefined>(undefined);
const PlannerDispatchContext = createContext<Dispatch<PlannerAction> | undefined>(
  undefined,
);

function normalizeStoredTask(task: Task): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    date: task.date,
    startTime: task.startTime,
    reminderMinutes: task.reminderMinutes,
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
): void {
  const latestValueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const flush = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(latestValueRef.current);
    } catch {
      return;
    }

    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(key, serialized))
      .catch(() => undefined);
  }, [enabled, key]);

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
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const [tasksRaw, notesRaw, legacyRaw] = await Promise.all([
          AsyncStorage.getItem(TASKS_STORAGE_KEY),
          AsyncStorage.getItem(NOTES_STORAGE_KEY),
          AsyncStorage.getItem(LEGACY_STORAGE_KEY),
        ]);
        const legacy = parseLegacyState(legacyRaw);
        const storedTasks =
          parseStoredArray<Task>(tasksRaw) ??
          (Array.isArray(legacy.tasks) ? legacy.tasks : []);
        const storedNotes =
          parseStoredArray<Note>(notesRaw) ??
          (Array.isArray(legacy.notes) ? legacy.notes : []);
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
            payload: {
              tasks: cleanTasks,
              notes: storedNotes,
            },
          });
        }
      } catch {
        if (active) {
          dispatch({ type: 'hydrate', payload: { tasks: [], notes: [] } });
        }
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  useDebouncedStorageWrite(TASKS_STORAGE_KEY, state.tasks, state.hydrated);
  useDebouncedStorageWrite(NOTES_STORAGE_KEY, state.notes, state.hydrated);

  return (
    <PlannerHydratedContext.Provider value={state.hydrated}>
      <PlannerDispatchContext.Provider value={dispatch}>
        <PlannerTasksContext.Provider value={state.tasks}>
          <PlannerNotesContext.Provider value={state.notes}>
            {children}
          </PlannerNotesContext.Provider>
        </PlannerTasksContext.Provider>
      </PlannerDispatchContext.Provider>
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

export function usePlannerNotes(): Note[] {
  const notes = useContext(PlannerNotesContext);
  if (!notes) {
    throw new Error('usePlannerNotes must be used inside PlannerProvider');
  }
  return notes;
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
