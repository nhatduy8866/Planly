import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { CalendarMode } from '../types';

interface CalendarNavigationValue {
  mode: CalendarMode;
  registerTodayHandler: (handler: () => void) => () => void;
  requestToday: () => void;
  setMode: (mode: CalendarMode) => void;
}

const CalendarNavigationContext = createContext<
  CalendarNavigationValue | undefined
>(undefined);

export function CalendarNavigationProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CalendarMode>('week');
  const todayHandlerRef = useRef<() => void>(() => undefined);

  const registerTodayHandler = useCallback((handler: () => void) => {
    todayHandlerRef.current = handler;
    return () => {
      if (todayHandlerRef.current === handler) {
        todayHandlerRef.current = () => undefined;
      }
    };
  }, []);

  const requestToday = useCallback(() => {
    todayHandlerRef.current();
  }, []);

  const value = useMemo(
    () => ({ mode, registerTodayHandler, requestToday, setMode }),
    [mode, registerTodayHandler, requestToday],
  );

  return (
    <CalendarNavigationContext.Provider value={value}>
      {children}
    </CalendarNavigationContext.Provider>
  );
}

export function useCalendarNavigation(): CalendarNavigationValue {
  const context = useContext(CalendarNavigationContext);
  if (!context) {
    throw new Error(
      'useCalendarNavigation phải được dùng bên trong CalendarNavigationProvider',
    );
  }
  return context;
}
