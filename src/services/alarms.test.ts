import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AlarmScheduler from 'react-native-alarm-scheduler';
import { Platform } from 'react-native';

import type { Task } from '../types';
import { isExpoGoRuntime } from '../utils/expoRuntime';
import {
  cancelTaskAlarm,
  consumePendingTaskAlarm,
  getAlarmPermission,
  getScheduledTaskAlarms,
  scheduleTaskAlarm,
} from './alarms';

jest.mock('react-native-alarm-scheduler', () => ({
  __esModule: true,
  default: {
    cancelAlarmAsync: jest.fn(async () => true),
    clearPendingNativeAlarmHandoffAsync: jest.fn(async () => undefined),
    completeNativeAlarmAsync: jest.fn(async () => undefined),
    getCurrentAlarmContextAsync: jest.fn(async () => null),
    getPendingNativeAlarmHandoffAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(),
    getScheduledAlarmsAsync: jest.fn(async () => []),
    openAlarmSettingsAsync: jest.fn(async () => true),
    openFullScreenIntentSettingsAsync: jest.fn(async () => true),
    requestPermissionsAsync: jest.fn(),
    scheduleAlarmAsync: jest.fn(),
  },
}));

jest.mock('../utils/expoRuntime', () => ({
  isExpoGoRuntime: jest.fn(() => false),
}));

const scheduler = jest.mocked(AlarmScheduler);
const mockIsExpoGoRuntime = jest.mocked(isExpoGoRuntime);

function permission(canScheduleExactAlarms = true) {
  return {
    canOpenSettings: true,
    canPostNotifications: true,
    canScheduleExactAlarms,
    canUseFullScreenIntent: true,
    platform: 'android' as const,
    status: canScheduleExactAlarms ? ('authorized' as const) : ('denied' as const),
  };
}

function futureTask(): Task {
  return {
    completed: false,
    createdAt: '2099-01-01T00:00:00.000Z',
    date: '2099-01-02',
    description: '',
    id: 'task-1',
    order: 0,
    reminderMinutes: 15,
    startTime: '14:00',
    title: 'Đá bóng',
    updatedAt: '2099-01-01T00:00:00.000Z',
  };
}

describe('native task alarms', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsExpoGoRuntime.mockReturnValue(false);
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    scheduler.getPermissionsAsync.mockResolvedValue(permission());
    scheduler.getScheduledAlarmsAsync.mockResolvedValue([]);
    scheduler.getCurrentAlarmContextAsync.mockResolvedValue(null);
    scheduler.getPendingNativeAlarmHandoffAsync.mockResolvedValue(null);
    scheduler.scheduleAlarmAsync.mockImplementation(async (input) => ({
      hour: input.hour,
      id: 'native-1',
      metadata: input.android?.metadata ?? input.ios?.metadata,
      minute: input.minute,
      platform: 'android',
      timestamp: input.timestamp ?? 0,
      title: input.title ?? '',
      weekdays: input.weekdays ?? [],
    }));
  });

  it('does not access the custom native alarm module inside Expo Go', async () => {
    mockIsExpoGoRuntime.mockReturnValue(true);

    await expect(getAlarmPermission()).resolves.toMatchObject({
      available: false,
      state: 'unsupported',
    });
    expect(scheduler.getPermissionsAsync).not.toHaveBeenCalled();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('schedules an exact full-screen alarm that rings and vibrates for at most five minutes', async () => {
    const task = futureTask();
    const metadata = {
      reminderKey: 'alarm-key',
      source: 'planly-task-reminder',
      taskId: task.id,
    };

    await expect(scheduleTaskAlarm(task, 'vi', metadata)).resolves.toBe(
      'alarm:native-1',
    );

    expect(scheduler.scheduleAlarmAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({
          fullScreen: true,
          fullScreenTarget: 'native',
          launchUri: 'planly://',
          maxRingDurationSeconds: 300,
          vibrate: true,
        }),
        ios: expect.objectContaining({
          alertActionMode: 'default',
          metadata,
          secondaryButtonBehavior: 'openApp',
          stopIntentBehavior: 'recordOnly',
        }),
        timestamp: new Date(2099, 0, 2, 14, 0).getTime(),
        title: task.title,
      }),
    );
  });

  it('does not schedule an alarm without exact-alarm access', async () => {
    scheduler.getPermissionsAsync.mockResolvedValue(permission(false));

    await expect(
      scheduleTaskAlarm(futureTask(), 'vi', { taskId: 'task-1' }),
    ).resolves.toBeUndefined();
    expect(scheduler.scheduleAlarmAsync).not.toHaveBeenCalled();
    await expect(getAlarmPermission()).resolves.toMatchObject({
      canScheduleExactAlarms: false,
      state: 'denied',
    });
  });

  it('maps scheduled metadata and cancels the prefixed native alarm ID', async () => {
    scheduler.getScheduledAlarmsAsync.mockResolvedValue([
      {
        hour: 13,
        id: 'native-1',
        metadata: {
          reminderKey: 'alarm-key',
          source: 'planly-task-reminder',
          taskId: 'task-1',
        },
        minute: 45,
        platform: 'android',
        timestamp: new Date(2099, 0, 2, 13, 45).getTime(),
        title: 'Đá bóng',
        weekdays: [],
      },
    ]);

    await expect(getScheduledTaskAlarms()).resolves.toEqual([
      {
        identifier: 'alarm:native-1',
        reminderKey: 'alarm-key',
        source: 'planly-task-reminder',
        taskId: 'task-1',
      },
    ]);
    await cancelTaskAlarm('alarm:native-1');
    expect(scheduler.cancelAlarmAsync).toHaveBeenCalledWith('native-1');
  });

  it('completes a ringing alarm handoff and returns its task', async () => {
    scheduler.getPendingNativeAlarmHandoffAsync.mockResolvedValue({
      action: 'secondaryOpen',
      alarmId: 'native-1',
      foregroundRequested: true,
      id: 'action-1',
      timestamp: Date.now(),
    });
    scheduler.getCurrentAlarmContextAsync.mockResolvedValue({
      id: 'native-1',
      metadata: { taskId: 'task-1' },
      state: 'alerting',
    });

    await expect(consumePendingTaskAlarm()).resolves.toEqual({
      alarmId: 'native-1',
      taskId: 'task-1',
    });
    expect(scheduler.completeNativeAlarmAsync).toHaveBeenCalledWith('native-1');
    expect(scheduler.clearPendingNativeAlarmHandoffAsync).toHaveBeenCalled();
  });
});
