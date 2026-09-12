import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';

import {
  dismissNativeAlarm,
  getActiveAlarmState,
} from '../services/alarms';
import { useAlarmTaskNavigation } from './useAlarmTaskNavigation';

const mockNavigate = jest.fn();
const mockRemove = jest.fn();
let mockAppStateListener: ((state: AppStateStatus) => void) | undefined;
let mockAlarmEventListener: (() => void) | undefined;
const mockUnsubscribeEvents = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock('../services/alarms', () => ({
  dismissNativeAlarm: jest.fn(async () => undefined),
  getActiveAlarmState: jest.fn(),
  subscribeAlarmEvents: jest.fn((cb: () => void) => {
    mockAlarmEventListener = cb;
    return mockUnsubscribeEvents;
  }),
}));

const mockGetActiveAlarmState = jest.mocked(getActiveAlarmState);
const mockDismissNativeAlarm = jest.mocked(dismissNativeAlarm);

interface TestRendererInstance {
  unmount(): void;
  update(element: ReturnType<typeof createElement>): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

describe('useAlarmTaskNavigation', () => {
  let tree: TestRendererInstance | undefined;
  let requestTask: jest.Mock<(taskId: string) => void>;
  let hookResult: ReturnType<typeof useAlarmTaskNavigation> | undefined;

  function Harness({ ready = true }: { ready?: boolean }) {
    hookResult = useAlarmTaskNavigation(requestTask, ready, [
      {
        completed: false,
        createdAt: '2026-09-11T00:00:00.000Z',
        date: '2026-09-11',
        description: 'Chi tiết task từ store',
        id: 'task-1',
        order: 0,
        priority: 'high',
        reminderMinutes: 15,
        startTime: '10:00',
        title: 'Họp công ty',
        updatedAt: '2026-09-11T00:00:00.000Z',
        color: '#10B981',
      },
    ]);
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateListener = undefined;
    mockAlarmEventListener = undefined;
    mockGetActiveAlarmState.mockResolvedValue(undefined);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(
      (_event, listener) => {
        mockAppStateListener = listener;
        return { remove: mockRemove };
      },
    );
    requestTask = jest.fn();
    hookResult = undefined;
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    jest.restoreAllMocks();
  });

  it('captures the ringing alarm and clears the native notification presentation', async () => {
    mockGetActiveAlarmState.mockResolvedValue({
      alarmId: 'native-1',
      taskId: 'task-1',
      title: 'Fallback title',
    });

    await act(async () => {
      tree = create(createElement(Harness));
    });

    expect(hookResult?.activeAlarm).toEqual({
      alarmId: 'native-1',
      task: {
        color: '#10B981',
        description: 'Chi tiết task từ store',
        id: 'task-1',
        priority: 'high',
        startTime: '10:00',
        title: 'Họp công ty',
      },
    });
    expect(mockDismissNativeAlarm).toHaveBeenCalledWith('native-1');
  });

  it('dismisses native alarm when dismissAlarm is called', async () => {
    mockGetActiveAlarmState.mockResolvedValue({
      alarmId: 'native-1',
      taskId: 'task-1',
    });

    await act(async () => {
      tree = create(createElement(Harness));
    });

    await act(async () => {
      await hookResult?.dismissAlarm();
    });

    expect(mockDismissNativeAlarm).toHaveBeenCalledWith('native-1');
    expect(hookResult?.activeAlarm).toBeNull();
    expect(requestTask).not.toHaveBeenCalled();
  });

  it('dismisses alarm and navigates to task when viewTask is called', async () => {
    mockGetActiveAlarmState.mockResolvedValue({
      alarmId: 'native-1',
      taskId: 'task-1',
    });

    await act(async () => {
      tree = create(createElement(Harness));
    });

    await act(async () => {
      await hookResult?.viewTask();
    });

    expect(mockDismissNativeAlarm).toHaveBeenCalledWith('native-1');
    expect(requestTask).toHaveBeenCalledWith('task-1');
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(hookResult?.activeAlarm).toBeNull();
  });

  it('waits until ready before checking alarm state', async () => {
    mockGetActiveAlarmState.mockResolvedValue({
      alarmId: 'native-2',
      taskId: 'task-2',
      title: 'Task Chưa Load',
      startTime: '11:00',
      priority: 'medium',
      color: '#F59E0B',
    });

    await act(async () => {
      tree = create(createElement(Harness, { ready: false }));
    });
    expect(mockGetActiveAlarmState).not.toHaveBeenCalled();

    await act(async () => {
      tree?.update(createElement(Harness, { ready: true }));
    });
    expect(hookResult?.activeAlarm?.task.title).toBe('Task Chưa Load');
  });

  it('checks again when app returns to active', async () => {
    await act(async () => {
      tree = create(createElement(Harness));
    });

    mockGetActiveAlarmState.mockResolvedValue({
      alarmId: 'native-3',
      taskId: 'task-1',
    });

    await act(async () => {
      mockAppStateListener?.('active');
    });

    expect(hookResult?.activeAlarm?.alarmId).toBe('native-3');
  });

  it('keeps the app alarm screen open after native presentation is cleared', async () => {
    mockGetActiveAlarmState.mockResolvedValueOnce({
      alarmId: 'native-screen-1',
      taskId: 'task-1',
    });

    await act(async () => {
      tree = create(createElement(Harness));
    });
    mockGetActiveAlarmState.mockResolvedValue(undefined);

    await act(async () => {
      mockAppStateListener?.('active');
    });

    expect(hookResult?.activeAlarm?.alarmId).toBe('native-screen-1');
  });

  it('checks when native alarm event fires', async () => {
    await act(async () => {
      tree = create(createElement(Harness));
    });

    mockGetActiveAlarmState.mockResolvedValue({
      alarmId: 'native-event-1',
      taskId: 'task-1',
    });

    await act(async () => {
      mockAlarmEventListener?.();
    });

    expect(hookResult?.activeAlarm?.alarmId).toBe('native-event-1');
  });

  it('removes listeners on unmount', async () => {
    await act(async () => {
      tree = create(createElement(Harness));
    });
    act(() => tree?.unmount());
    tree = undefined;

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribeEvents).toHaveBeenCalledTimes(1);
  });
});
