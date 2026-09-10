import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';

import type { ReminderReconciliationResult } from '../services/reminderReconciliation';
import type { Task } from '../types';
import { useReminderReconciliation } from './useReminderReconciliation';

const mockReconcileTaskReminders = jest.fn<
  (...args: unknown[]) => Promise<ReminderReconciliationResult>
>();
const mockRemove = jest.fn();
let mockAppStateListener: ((state: AppStateStatus) => void) | undefined;

jest.mock('../services/reminderReconciliation', () => ({
  reconcileTaskReminders: (...args: unknown[]) =>
    mockReconcileTaskReminders(...args),
}));

interface TestRendererInstance {
  unmount(): void;
  update(element: ReturnType<typeof createElement>): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

function task(title = 'Đá bóng'): Task {
  return {
    completed: false,
    createdAt: '2099-01-01T00:00:00.000Z',
    date: '2099-01-02',
    description: '',
    id: 'task-1',
    order: 0,
    reminderMinutes: 15,
    startTime: '14:00',
    title,
    updatedAt: '2099-01-01T00:00:00.000Z',
  };
}

describe('useReminderReconciliation', () => {
  let tree: TestRendererInstance | undefined;
  let dispatch: jest.Mock;

  function Harness({ enabled = true, tasks = [task()] }) {
    useReminderReconciliation(tasks, 'vi', enabled, dispatch);
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(
      (_event, listener) => {
        mockAppStateListener = listener;
        return { remove: mockRemove };
      },
    );
    dispatch = jest.fn();
    mockReconcileTaskReminders.mockResolvedValue({
      canceled: 0,
      errors: 0,
      notificationIdUpdates: [],
      scheduled: 0,
    });
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    jest.restoreAllMocks();
  });

  it('runs after hydration and uses the latest tasks when app returns active', async () => {
    await act(async () => {
      tree = create(createElement(Harness, { enabled: false }));
    });
    expect(mockReconcileTaskReminders).not.toHaveBeenCalled();

    await act(async () => {
      tree?.update(createElement(Harness, { enabled: true }));
    });
    expect(mockReconcileTaskReminders).toHaveBeenCalledTimes(1);

    const updatedTasks = [task('Đá bóng chiều')];
    await act(async () => {
      tree?.update(createElement(Harness, { enabled: true, tasks: updatedTasks }));
    });
    await act(async () => {
      mockAppStateListener?.('active');
    });

    expect(mockReconcileTaskReminders).toHaveBeenCalledTimes(2);
    expect(mockReconcileTaskReminders).toHaveBeenLastCalledWith(
      updatedTasks,
      'vi',
    );
  });

  it('dispatches only notification ID changes returned by reconciliation', async () => {
    mockReconcileTaskReminders.mockResolvedValue({
      canceled: 0,
      errors: 0,
      notificationIdUpdates: [
        { id: 'task-1', notificationId: 'notification-1' },
      ],
      scheduled: 1,
    });

    await act(async () => {
      tree = create(createElement(Harness));
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'sync_notification_ids',
      payload: [{ id: 'task-1', notificationId: 'notification-1' }],
    });
  });

  it('removes the app-state listener on unmount', async () => {
    await act(async () => {
      tree = create(createElement(Harness));
    });
    act(() => tree?.unmount());
    tree = undefined;

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
