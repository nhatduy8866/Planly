import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Task } from '../types';
import { clearStoredAlarmMedia } from './alarmMedia';
import { clearLocalPlanlyData } from './localDataCleanup';
import { cancelTaskReminder } from './notifications';
import { clearSyncOutbox } from './sync/outbox';
import { syncTodayWidget } from '../widgets/todayWidgetSync';

const mockMultiRemove = jest.fn<(keys: string[]) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    multiRemove: (keys: string[]) => mockMultiRemove(keys),
  },
}));

jest.mock('./alarmMedia', () => ({
  clearStoredAlarmMedia: jest.fn(async () => undefined),
}));

jest.mock('./notifications', () => ({
  cancelTaskReminder: jest.fn(async () => undefined),
}));

jest.mock('./sync/outbox', () => ({
  clearSyncOutbox: jest.fn(async () => undefined),
}));

jest.mock('../widgets/todayWidgetSync', () => ({
  syncTodayWidget: jest.fn(async () => undefined),
}));

const task: Task = {
  completed: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  date: '2026-09-27',
  description: '',
  id: 'task-1',
  notificationId: 'notification-1',
  order: 0,
  priority: 'medium',
  startTime: '09:00',
  title: 'Private task',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('local Planly data cleanup', () => {
  const persistTasks = jest.fn<(tasks: Task[]) => Promise<void>>();
  const resetPreferences = jest.fn<() => Promise<void>>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMultiRemove.mockResolvedValue(undefined);
    persistTasks.mockResolvedValue(undefined);
    resetPreferences.mockResolvedValue(undefined);
  });

  it('durably clears account tasks before removing owner state on sign out', async () => {
    await clearLocalPlanlyData({
      language: 'en',
      mode: 'signOut',
      persistTasks,
      resetPreferences,
      tasks: [task],
      theme: 'dark',
    });

    expect(cancelTaskReminder).toHaveBeenCalledWith('notification-1');
    expect(persistTasks).toHaveBeenCalledWith([]);
    expect(mockMultiRemove).toHaveBeenCalledWith([
      '@planly/planner/v1',
      '@planly/sync/cache-owner/v1',
      '@planly/widget/completions/v1',
    ]);
    expect(clearSyncOutbox).toHaveBeenCalledTimes(1);
    expect(syncTodayWidget).toHaveBeenCalledWith([], 'en', 'dark', []);
    expect(persistTasks.mock.invocationCallOrder[0]).toBeLessThan(
      mockMultiRemove.mock.invocationCallOrder[0],
    );
    expect(clearStoredAlarmMedia).not.toHaveBeenCalled();
    expect(resetPreferences).not.toHaveBeenCalled();
  });

  it('also erases custom media and personal preferences on account deletion', async () => {
    await clearLocalPlanlyData({
      language: 'vi',
      mode: 'deleteAccount',
      persistTasks,
      resetPreferences,
      tasks: [task],
      theme: 'light',
    });

    expect(clearStoredAlarmMedia).toHaveBeenCalledTimes(1);
    expect(resetPreferences).toHaveBeenCalledTimes(1);
  });

  it('continues erasing data when a reminder is already unavailable', async () => {
    jest.mocked(cancelTaskReminder).mockRejectedValueOnce(
      new Error('reminder missing'),
    );

    await clearLocalPlanlyData({
      language: 'vi',
      mode: 'signOut',
      persistTasks,
      resetPreferences,
      tasks: [task],
      theme: 'light',
    });

    expect(persistTasks).toHaveBeenCalledWith([]);
    expect(mockMultiRemove).toHaveBeenCalledTimes(1);
  });

  it('keeps the owner retry marker but attempts other erasure when task storage fails', async () => {
    persistTasks.mockRejectedValue(new Error('storage unavailable'));

    await expect(clearLocalPlanlyData({
      language: 'vi',
      mode: 'signOut',
      persistTasks,
      resetPreferences,
      tasks: [task],
      theme: 'light',
    })).rejects.toThrow('storage unavailable');

    expect(mockMultiRemove).not.toHaveBeenCalled();
    expect(clearSyncOutbox).toHaveBeenCalledTimes(1);
    expect(syncTodayWidget).toHaveBeenCalledTimes(1);
  });

  it('attempts deletion-only cleanup even when task storage fails', async () => {
    persistTasks.mockRejectedValue(new Error('storage unavailable'));

    await expect(clearLocalPlanlyData({
      language: 'vi',
      mode: 'deleteAccount',
      persistTasks,
      resetPreferences,
      tasks: [task],
      theme: 'light',
    })).rejects.toThrow('storage unavailable');

    expect(clearStoredAlarmMedia).toHaveBeenCalledTimes(1);
    expect(resetPreferences).toHaveBeenCalledTimes(1);
  });
});
