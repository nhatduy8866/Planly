import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { Task } from '../types';
import {
  getNotificationPermission,
  initializeNotifications,
  openNotificationSettings,
  requestNotificationPermission,
  scheduleTaskReminder,
} from './notifications';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

const getPermissionsAsync = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissionsAsync = jest.mocked(Notifications.requestPermissionsAsync);
const scheduleNotificationAsync = jest.mocked(Notifications.scheduleNotificationAsync);
const setNotificationChannelAsync = jest.mocked(
  Notifications.setNotificationChannelAsync,
);

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
        sound: 'default',
      }),
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
          sound: 'default',
        }),
        trigger: expect.objectContaining({ channelId: 'planly-reminders-v2' }),
      }),
    );
  });

  it('opens the native app settings when permission must be changed manually', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await openNotificationSettings();

    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });
});
