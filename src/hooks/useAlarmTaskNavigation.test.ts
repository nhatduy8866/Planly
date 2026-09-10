import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';

import { consumePendingTaskAlarm } from '../services/alarms';
import { useAlarmTaskNavigation } from './useAlarmTaskNavigation';

const mockNavigate = jest.fn();
const mockRemove = jest.fn();
let mockAppStateListener: ((state: AppStateStatus) => void) | undefined;

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock('../services/alarms', () => ({
  consumePendingTaskAlarm: jest.fn(),
}));

const mockConsumePendingTaskAlarm = jest.mocked(consumePendingTaskAlarm);

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

  function Harness({ ready = true }: { ready?: boolean }) {
    useAlarmTaskNavigation(requestTask, ready);
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppStateListener = undefined;
    mockConsumePendingTaskAlarm.mockResolvedValue(undefined);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(
      (_event, listener) => {
        mockAppStateListener = listener;
        return { remove: mockRemove };
      },
    );
    requestTask = jest.fn();
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    jest.restoreAllMocks();
  });

  it('opens the task handed off by a ringing alarm on cold start', async () => {
    mockConsumePendingTaskAlarm.mockResolvedValue({
      alarmId: 'native-1',
      taskId: 'task-1',
    });

    await act(async () => {
      tree = create(createElement(Harness));
    });

    expect(requestTask).toHaveBeenCalledWith('task-1');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('waits until the store and router are ready', async () => {
    mockConsumePendingTaskAlarm.mockResolvedValue({
      alarmId: 'native-2',
      taskId: 'task-2',
    });

    await act(async () => {
      tree = create(createElement(Harness, { ready: false }));
    });
    expect(mockConsumePendingTaskAlarm).not.toHaveBeenCalled();

    await act(async () => {
      tree?.update(createElement(Harness, { ready: true }));
    });
    expect(requestTask).toHaveBeenCalledWith('task-2');
  });

  it('checks for another handoff when the app returns active', async () => {
    await act(async () => {
      tree = create(createElement(Harness));
    });
    mockConsumePendingTaskAlarm.mockResolvedValue({
      alarmId: 'native-3',
      taskId: 'task-3',
    });

    await act(async () => {
      mockAppStateListener?.('active');
    });

    expect(requestTask).toHaveBeenCalledWith('task-3');
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
