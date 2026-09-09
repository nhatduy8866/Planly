import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { Language } from '../i18n/translations';
import type { Task } from '../types';
import { taskDateTime } from '../utils/date';

// Version the channel when changing sound/importance because Android keeps those
// settings immutable after a channel is created on an installed device.
const CHANNEL_ID = 'planly-reminders-v2';
const CHANNEL_COLOR = '#4F46E5';

export type NotificationPermissionState =
  | 'denied'
  | 'granted'
  | 'undetermined'
  | 'unsupported';

export interface NotificationPermissionSummary {
  canAskAgain: boolean;
  state: NotificationPermissionState;
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function unsupportedPermission(): NotificationPermissionSummary {
  return { canAskAgain: false, state: 'unsupported' };
}

function summarizePermission(
  permission: Notifications.NotificationPermissionsStatus,
): NotificationPermissionSummary {
  const granted =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  return {
    canAskAgain: permission.canAskAgain,
    state: granted
      ? 'granted'
      : permission.status === 'undetermined'
        ? 'undetermined'
        : 'denied',
  };
}

async function ensureAndroidChannel(language: Language): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      description:
        language === 'vi'
          ? 'Thông báo nhắc lịch và công việc sắp đến'
          : 'Alerts for upcoming schedules and tasks',
      enableLights: true,
      enableVibrate: true,
      name: language === 'vi' ? 'Nhắc lịch Planly' : 'Planly reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: CHANNEL_COLOR,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
      sound: 'default',
      vibrationPattern: [0, 200, 150, 200],
    });
  }
}

export async function initializeNotifications(
  language: Language = 'vi',
): Promise<NotificationPermissionSummary> {
  if (Platform.OS === 'web') return unsupportedPermission();

  // Android 13 only shows the notification permission prompt after a channel exists.
  await ensureAndroidChannel(language);
  return summarizePermission(await Notifications.getPermissionsAsync());
}

export async function getNotificationPermission(
  language: Language = 'vi',
): Promise<NotificationPermissionSummary> {
  if (Platform.OS === 'web') return unsupportedPermission();
  await ensureAndroidChannel(language);
  return summarizePermission(await Notifications.getPermissionsAsync());
}

export async function requestNotificationPermission(
  language: Language = 'vi',
): Promise<NotificationPermissionSummary> {
  if (Platform.OS === 'web') return unsupportedPermission();

  await ensureAndroidChannel(language);

  const current = await Notifications.getPermissionsAsync();
  const currentSummary = summarizePermission(current);
  if (currentSummary.state === 'granted' || !currentSummary.canAskAgain) {
    return currentSummary;
  }

  const requested = await Notifications.requestPermissionsAsync({
    android: {},
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return summarizePermission(requested);
}

export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Linking.openSettings();
}

export async function cancelTaskReminder(notificationId?: string): Promise<void> {
  if (Platform.OS === 'web' || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Notification may already have fired or been removed by the OS.
  }
}

export async function scheduleTaskReminder(
  task: Task,
  language: Language = 'vi',
): Promise<string | undefined> {
  if (Platform.OS === 'web' || task.reminderMinutes === null) return undefined;

  const triggerDate = taskDateTime(task.date, task.startTime);
  triggerDate.setMinutes(triggerDate.getMinutes() - task.reminderMinutes);
  if (triggerDate.getTime() <= Date.now()) return undefined;
  const permission = await requestNotificationPermission(language);
  if (permission.state !== 'granted') return undefined;

  return Notifications.scheduleNotificationAsync({
    content: {
      title:
        language === 'vi'
          ? task.reminderMinutes === 0
            ? 'Đến giờ rồi'
            : 'Sắp đến lịch'
          : task.reminderMinutes === 0
            ? 'It’s time'
            : 'Coming up soon',
      body: `${task.startTime} · ${task.title}`,
      data: { taskId: task.id },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
    },
  });
}
