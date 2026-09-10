import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { Task } from '../types';
import * as Alarms from './alarms';
import {
  cancelTaskReminder,
  getAllScheduledTaskReminders,
  getNotificationPermission,
  getTaskReminderReadiness,
  initializeNotifications,
  openNotificationSettings,
  requestNotificationPermission,
  scheduleTaskReminder,
} from './notifications';

jest.mock('./alarms', () => ({
  cancelTaskAlarm: jest.fn(async () => undefined),
  getAlarmPermission: jest.fn(),
  getScheduledTaskAlarms: jest.fn(async () => []),
  isAlarmReminderId: jest.fn((id?: string) => id?.startsWith('alarm:')),
  scheduleTaskAlarm: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

const getPermissionsAsync = jest.mocked(Notifications.getPermissionsAsync);
const getAllScheduledNotificationsAsync = jest.mocked(
  Notifications.getAllScheduledNotificationsAsync,
);
const requestPermissionsAsync = jest.mocked(Notifications.requestPermissionsAsync);
const scheduleNotificationAsync = jest.mocked(Notifications.scheduleNotificationAsync);
const setNotificationChannelAsync = jest.mocked(
  Notifications.setNotificationChannelAsync,
);
const mockCancelTaskAlarm = jest.mocked(Alarms.cancelTaskAlarm);
const mockGetAlarmPermission = jest.mocked(Alarms.getAlarmPermission);
const mockGetScheduledTaskAlarms = jest.mocked(Alarms.getScheduledTaskAlarms);
const mockScheduleTaskAlarm = jest.mocked(Alarms.scheduleTaskAlarm);

function permission(
  status: 'denied' | 'granted' | 'undetermined',
  canAskAgain: boolean,
  overrides: Partial<Notifications.NotificationPermissionsStatus> = {},
): Notifications.NotificationPermissionsStatus {
  return {
    canAskAgain,
    expires: 'never',
    granted: status === 'granted',
    status,
    ...overrides,
  } as Notifications.NotificationPermissionsStatus;
}

function makeFutureTask(): Task {
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

describe('notification foundation', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAlarmPermission.mockResolvedValue({
      available: true,
      canOpenSettings: true,
      canPostNotifications: true,
      canScheduleExactAlarms: true,
      canUseFullScreenIntent: true,
      state: 'granted',
    });
    mockGetScheduledTaskAlarms.mockResolvedValue([]);
    mockScheduleTaskAlarm.mockResolvedValue('alarm:native-1');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('creates the high-importance Android channel before reading permission', async () => {
    getPermissionsAsync.mockResolvedValue(permission('undetermined', true));

    await expect(initializeNotifications('vi')).resolves.toEqual({
      canAskAgain: true,
      state: 'undetermined',
    });

    expect(setNotificationChannelAsync).toHaveBeenCalledWith(
      'planly-reminders-v2',
      expect.objectContaining({
        enableVibrate: true,
        importance: 6,
        lockscreenVisibility: 1,
      }),
    );
    expect(setNotificationChannelAsync.mock.calls[0]?.[1]).not.toHaveProperty(
      'sound',
    );
    expect(setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      getPermissionsAsync.mock.invocationCallOrder[0],
    );
  });

  it('does not show another prompt after permission can no longer be requested', async () => {
    getPermissionsAsync.mockResolvedValue(permission('denied', false));

    await expect(requestNotificationPermission('en')).resolves.toEqual({
      canAskAgain: false,
      state: 'denied',
    });
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests alerts and sound, then returns the granted permission', async () => {
    getPermissionsAsync.mockResolvedValue(permission('undetermined', true));
    requestPermissionsAsync.mockResolvedValue(permission('granted', true));

    await expect(requestNotificationPermission()).resolves.toEqual({
      canAskAgain: true,
      state: 'granted',
    });
    expect(requestPermissionsAsync).toHaveBeenCalledWith({
      android: {},
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  });

  it('treats provisional iOS authorization as granted', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    getPermissionsAsync.mockResolvedValue(
      permission('undetermined', true, {
        ios: { status: 3 } as Notifications.NotificationPermissionsStatus['ios'],
      }),
    );

    await expect(getNotificationPermission()).resolves.toEqual({
      canAskAgain: true,
      state: 'granted',
    });
  });

  it('schedules the task on the reminder channel after permission is granted', async () => {
    getPermissionsAsync.mockResolvedValue(permission('granted', true));
    scheduleNotificationAsync.mockResolvedValue('notification-1');

    await expect(scheduleTaskReminder(makeFutureTask(), 'vi')).resolves.toBe(
      'notification-1',
    );
    expect(scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: '14:00 · Đá bóng',
          data: expect.objectContaining({
            reminderKey: expect.any(String),
            source: 'planly-task-reminder',
            taskId: 'task-1',
          }),
          sound: 'default',
        }),
        trigger: expect.objectContaining({ channelId: 'planly-reminders-v2' }),
      }),
    );
  });

  it('schedules an alarm when that mode is selected and permissions are ready', async () => {
    getPermissionsAsync.mockResolvedValue(permission('granted', true));

    await expect(
      scheduleTaskReminder(makeFutureTask(), 'vi', 'alarm'),
    ).resolves.toBe('alarm:native-1');

    expect(mockScheduleTaskAlarm).toHaveBeenCalledWith(
      makeFutureTask(),
      'vi',
      expect.objectContaining({
        source: 'planly-task-reminder',
        taskId: 'task-1',
      }),
    );
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('falls back to a standard notification when exact alarm access is unavailable', async () => {
    getPermissionsAsync.mockResolvedValue(permission('granted', true));
    mockGetAlarmPermission.mockResolvedValue({
      available: true,
      canOpenSettings: true,
      canPostNotifications: true,
      canScheduleExactAlarms: false,
      canUseFullScreenIntent: true,
      state: 'denied',
    });
    scheduleNotificationAsync.mockResolvedValue('notification-fallback');

    await expect(
      scheduleTaskReminder(makeFutureTask(), 'vi', 'alarm'),
    ).resolves.toBe('notification-fallback');

    expect(mockScheduleTaskAlarm).not.toHaveBeenCalled();
    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('reports alarm readiness and combines both native reminder queues', async () => {
    getPermissionsAsync.mockResolvedValue(permission('granted', true));
    getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        content: {
          data: {
            reminderKey: 'notification-key',
            source: 'planly-task-reminder',
            taskId: 'task-1',
          },
        },
        identifier: 'notification-1',
        trigger: null,
      } as unknown as Notifications.NotificationRequest,
    ]);
    mockGetScheduledTaskAlarms.mockResolvedValue([
      {
        identifier: 'alarm:native-1',
        reminderKey: 'alarm-key',
        source: 'planly-task-reminder',
        taskId: 'task-2',
      },
    ]);

    await expect(getTaskReminderReadiness('alarm', 'vi')).resolves.toEqual({
      canSchedule: true,
      deliveryMode: 'alarm',
    });
    await expect(getAllScheduledTaskReminders()).resolves.toHaveLength(2);
  });

  it('routes alarm IDs to the native alarm canceler', async () => {
    await cancelTaskReminder('alarm:native-1');

    expect(mockCancelTaskAlarm).toHaveBeenCalledWith('alarm:native-1');
    expect(
      Notifications.cancelScheduledNotificationAsync,
    ).not.toHaveBeenCalled();
  });

  it('opens the native app settings when permission must be changed manually', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await openNotificationSettings();

    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('deduplicates native setup while scheduling reminders concurrently', async () => {
    getPermissionsAsync.mockResolvedValue(permission('granted', true));
    scheduleNotificationAsync
      .mockResolvedValueOnce('notification-1')
      .mockResolvedValueOnce('notification-2');

    await expect(
      Promise.all([
        scheduleTaskReminder(makeFutureTask(), 'en'),
        scheduleTaskReminder({ ...makeFutureTask(), id: 'task-2' }, 'en'),
      ]),
    ).resolves.toEqual(['notification-1', 'notification-2']);

    expect(setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    expect(getPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
