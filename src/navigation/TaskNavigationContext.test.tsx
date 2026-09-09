import { act, createElement, useEffect } from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  TaskNavigationProvider,
  useTaskNavigation,
} from './TaskNavigationContext';

interface TestRendererInstance {
  unmount(): void;
  update(element: ReturnType<typeof createElement>): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

describe('TaskNavigationProvider', () => {
  let requestTask: ((taskId: string) => void) | undefined;
  let handledTask: jest.Mock<(taskId: string) => void>;

  function RequestHarness() {
    requestTask = useTaskNavigation().requestTask;
    return null;
  }

  function HandlerHarness() {
    const { registerTaskHandler } = useTaskNavigation();
    useEffect(() => registerTaskHandler(handledTask), [registerTaskHandler]);
    return null;
  }

  function App({ handlerMounted }: { handlerMounted: boolean }) {
    return createElement(
      TaskNavigationProvider,
      null,
      createElement(RequestHarness),
      handlerMounted ? createElement(HandlerHarness) : null,
    );
  }

  beforeEach(() => {
    requestTask = undefined;
    handledTask = jest.fn();
  });

  it('queues a task request until the schedule handler is mounted', () => {
    let tree!: TestRendererInstance;
    act(() => {
      tree = create(createElement(App, { handlerMounted: false }));
    });
    act(() => requestTask?.('task-1'));
    expect(handledTask).not.toHaveBeenCalled();

    act(() => {
      tree.update(createElement(App, { handlerMounted: true }));
    });

    expect(handledTask).toHaveBeenCalledWith('task-1');
    act(() => tree.unmount());
  });

  it('delivers subsequent requests directly to the mounted handler', () => {
    let tree!: TestRendererInstance;
    act(() => {
      tree = create(createElement(App, { handlerMounted: true }));
    });
    act(() => requestTask?.('task-2'));

    expect(handledTask).toHaveBeenCalledWith('task-2');
    act(() => tree.unmount());
  });
});
