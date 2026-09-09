import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

type TaskNavigationHandler = (taskId: string) => void;

interface TaskNavigationValue {
  registerTaskHandler: (handler: TaskNavigationHandler) => () => void;
  requestTask: (taskId: string) => void;
}

const TaskNavigationContext = createContext<TaskNavigationValue | undefined>(
  undefined,
);

export function TaskNavigationProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<TaskNavigationHandler | undefined>(undefined);
  const pendingTaskIdRef = useRef<string | undefined>(undefined);

  const registerTaskHandler = useCallback((handler: TaskNavigationHandler) => {
    handlerRef.current = handler;

    const pendingTaskId = pendingTaskIdRef.current;
    if (pendingTaskId) {
      pendingTaskIdRef.current = undefined;
      handler(pendingTaskId);
    }

    return () => {
      if (handlerRef.current === handler) handlerRef.current = undefined;
    };
  }, []);

  const requestTask = useCallback((taskId: string) => {
    const handler = handlerRef.current;
    if (handler) {
      handler(taskId);
    } else {
      pendingTaskIdRef.current = taskId;
    }
  }, []);

  const value = useMemo(
    () => ({ registerTaskHandler, requestTask }),
    [registerTaskHandler, requestTask],
  );

  return (
    <TaskNavigationContext.Provider value={value}>
      {children}
    </TaskNavigationContext.Provider>
  );
}

export function useTaskNavigation(): TaskNavigationValue {
  const context = useContext(TaskNavigationContext);
  if (!context) {
    throw new Error(
      'useTaskNavigation phải được dùng bên trong TaskNavigationProvider',
    );
  }
  return context;
}
