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

import type { PlannerState } from '../types';
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

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(plannerReducer, initialPlannerState);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<PlannerState>) : {};
        if (active) {
          dispatch({
            type: 'hydrate',
            payload: {
              tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
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
