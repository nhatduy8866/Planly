import { act, createElement, useEffect } from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  AddTaskNavigationProvider,
  type AddTaskTarget,
  useAddTaskNavigation,
} from './AddTaskNavigationContext';

interface TestRendererInstance {
  unmount(): void;
  update(element: ReturnType<typeof createElement>): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

describe('AddTaskNavigationProvider', () => {
  let requestAddTask: ((target: AddTaskTarget) => void) | undefined;
  let scheduleHandler: jest.Mock<() => void>;
  let tasksHandler: jest.Mock<() => void>;

  function RequestHarness() {
    requestAddTask = useAddTaskNavigation().requestAddTask;
    return null;
  }

  function HandlerHarness({ target }: { target: AddTaskTarget }) {
    const { registerAddTaskHandler } = useAddTaskNavigation();
    const handler = target === 'schedule' ? scheduleHandler : tasksHandler;
    useEffect(
      () => registerAddTaskHandler(target, handler),
      [handler, registerAddTaskHandler, target],
    );
    return null;
  }

  function App({ tasksMounted = true }: { tasksMounted?: boolean }) {
    return createElement(
      AddTaskNavigationProvider,
      null,
      createElement(RequestHarness),
      createElement(HandlerHarness, { target: 'schedule' }),
      tasksMounted ? createElement(HandlerHarness, { target: 'tasks' }) : null,
    );
  }

  beforeEach(() => {
    requestAddTask = undefined;
    scheduleHandler = jest.fn();
    tasksHandler = jest.fn();
  });

  it('runs only the add handler registered for the active target', () => {
    let tree!: TestRendererInstance;
    act(() => {
      tree = create(createElement(App));
    });

    act(() => requestAddTask?.('schedule'));
    expect(scheduleHandler).toHaveBeenCalledTimes(1);
    expect(tasksHandler).not.toHaveBeenCalled();

    act(() => requestAddTask?.('tasks'));
    expect(tasksHandler).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('delivers a pending request after its target screen mounts', () => {
    let tree!: TestRendererInstance;
    act(() => {
      tree = create(createElement(App, { tasksMounted: false }));
    });
    act(() => requestAddTask?.('tasks'));
    expect(tasksHandler).not.toHaveBeenCalled();

    act(() => {
      tree.update(createElement(App, { tasksMounted: true }));
    });

    expect(tasksHandler).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
});
