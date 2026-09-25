import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

export type AddTaskTarget = 'schedule' | 'tasks';

type AddTaskHandler = () => void;

interface AddTaskNavigationValue {
  registerAddTaskHandler: (
    target: AddTaskTarget,
    handler: AddTaskHandler,
  ) => () => void;
  requestAddTask: (target: AddTaskTarget) => void;
}

const AddTaskNavigationContext = createContext<
  AddTaskNavigationValue | undefined
>(undefined);

export function AddTaskNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const handlersRef = useRef<Partial<Record<AddTaskTarget, AddTaskHandler>>>({});
  const pendingTargetsRef = useRef(new Set<AddTaskTarget>());

  const registerAddTaskHandler = useCallback(
    (target: AddTaskTarget, handler: AddTaskHandler) => {
      handlersRef.current[target] = handler;

      if (pendingTargetsRef.current.delete(target)) handler();

      return () => {
        if (handlersRef.current[target] === handler) {
          delete handlersRef.current[target];
        }
      };
    },
    [],
  );

  const requestAddTask = useCallback((target: AddTaskTarget) => {
    const handler = handlersRef.current[target];
    if (handler) handler();
    else pendingTargetsRef.current.add(target);
  }, []);

  const value = useMemo(
    () => ({ registerAddTaskHandler, requestAddTask }),
    [registerAddTaskHandler, requestAddTask],
  );

  return (
    <AddTaskNavigationContext.Provider value={value}>
      {children}
    </AddTaskNavigationContext.Provider>
  );
}

export function useAddTaskNavigation(): AddTaskNavigationValue {
  const context = useContext(AddTaskNavigationContext);
  if (!context) {
    throw new Error(
      'useAddTaskNavigation phải được dùng bên trong AddTaskNavigationProvider',
    );
  }
  return context;
}
