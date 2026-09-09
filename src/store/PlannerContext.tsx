import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';

import type { PlannerState, Task } from '../types';
import {
  initialPlannerState,
  plannerReducer,
  type PlannerAction,
} from './plannerReducer';

const STORAGE_KEY = '@planly/planner/v1';

interface PlannerContextValue {
  state: PlannerState;
  dispatch: Dispatch<PlannerAction>;
}

const PlannerContext = createContext<PlannerContextValue | undefined>(undefined);

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
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<PlannerState>) : {};
        const cleanTasks = Array.isArray(parsed.tasks)
          ? parsed.tasks
              .filter(
                (t) => typeof t?.id === 'string' && !t.id.startsWith('perf-mock-task-'),
              )
              .map(normalizeStoredTask)
          : [];

        if (active) {
          dispatch({
            type: 'hydrate',
            payload: {
              tasks: cleanTasks,
              notes: Array.isArray(parsed.notes) ? parsed.notes : [],
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

  useEffect(() => {
    if (!state.hydrated) return;
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tasks: state.tasks, notes: state.notes }),
    );
  }, [state.hydrated, state.notes, state.tasks]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  );
}

export function usePlanner(): PlannerContextValue {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner phải được dùng bên trong PlannerProvider');
  }
  return context;
}
