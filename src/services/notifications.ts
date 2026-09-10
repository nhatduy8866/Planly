import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { Language } from '../i18n/translations';
import type {
  ReminderDeliveryMode,
  ScheduledTaskReminder,
  Task,
} from '../types';
import { taskDateTime } from '../utils/date';
import { isExpoGoRuntime } from '../utils/expoRuntime';
import {
  cancelTaskAlarm,
  getAlarmPermission,
  getScheduledTaskAlarms,
  isAlarmReminderId,
  scheduleTaskAlarm,
} from './alarms';

// Version the channel when changing sound/importance because Android keeps those
// settings immutable after a channel is created on an installed device.
const CHANNEL_ID = 'planly-reminders-v2';
const CHANNEL_COLOR = '#4F46E5';
export const TASK_REMINDER_SOURCE = 'planly-task-reminder';
const TASK_REMINDER_SCHEMA_VERSION = 2;
let configuredAndroidChannelLanguage: Language | undefined;
let androidChannelSetupPromise: Promise<void> | undefined;
let permissionRequestPromise: Promise<NotificationPermissionSummary> | undefined;

export type NotificationPermissionState =
  | 'denied'
  | 'granted'
  | 'undetermined'
  | 'unsupported';

export interface NotificationPermissionSummary {
  canAskAgain: boolean;
  state: NotificationPermissionState;
}

export interface TaskReminderReadiness {
  canSchedule: boolean;
  deliveryMode: ReminderDeliveryMode;
}

export function getTaskReminderDate(task: Task): Date | undefined {
  if (task.completed || task.reminderMinutes === null) return undefined;
  const triggerDate = taskDateTime(task.date, task.startTime);
  return Number.isFinite(triggerDate.getTime()) ? triggerDate : undefined;
}

export function getTaskReminderKey(
  task: Task,
  language: Language = 'vi',
  deliveryMode: ReminderDeliveryMode = 'notification',
): string {
  return JSON.stringify([
    TASK_REMINDER_SCHEMA_VERSION,
    language,
    deliveryMode,
    task.id,
    task.title,
    task.date,
    task.startTime,
  ]);
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
  if (Platform.OS !== 'android') return;
  if (configuredAndroidChannelLanguage === language) return;

  if (androidChannelSetupPromise) {
    await androidChannelSetupPromise;
    if (configuredAndroidChannelLanguage === language) return;
  }

  const setupPromise = Notifications.setNotificationChannelAsync(CHANNEL_ID, {
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
    vibrationPattern: [0, 200, 150, 200],
  })
    .then(() => {
      configuredAndroidChannelLanguage = language;
    })
    .finally(() => {
      if (androidChannelSetupPromise === setupPromise) {
        androidChannelSetupPromise = undefined;
      }
    });
  androidChannelSetupPromise = setupPromise;
  await setupPromise;
}

async function readOrRequestPermission(): Promise<
  NotificationPermissionSummary
> {
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
  if (permissionRequestPromise) return permissionRequestPromise;

  const requestPromise = readOrRequestPermission().finally(() => {
    if (permissionRequestPromise === requestPromise) {
      permissionRequestPromise = undefined;
    }
  });
  permissionRequestPromise = requestPromise;
  return requestPromise;
}

export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Linking.openSettings();
}

export async function getTaskReminderReadiness(
  preferredMode: ReminderDeliveryMode,
  language: Language = 'vi',
): Promise<TaskReminderReadiness> {
  const notificationPermission = await getNotificationPermission(language);
  if (preferredMode === 'notification') {
    return {
      canSchedule: notificationPermission.state === 'granted',
      deliveryMode: 'notification',
    };
  }

  const alarmPermission = await getAlarmPermission();
  const alarmReady =
    alarmPermission.available &&
    alarmPermission.canScheduleExactAlarms &&
    (Platform.OS !== 'android' ||
      (alarmPermission.canPostNotifications &&
        notificationPermission.state === 'granted'));

  return alarmReady
    ? { canSchedule: true, deliveryMode: 'alarm' }
    : {
        canSchedule: notificationPermission.state === 'granted',
        deliveryMode: 'notification',
      };
}

export async function getAllScheduledTaskReminders(): Promise<
  ScheduledTaskReminder[]
> {
  if (Platform.OS === 'web') return [];

  const [notificationRequests, alarms] = await Promise.all([
    Notifications.getAllScheduledNotificationsAsync(),
    getScheduledTaskAlarms(),
  ]);
  const notifications = notificationRequests.map((request) => {
    const data = request.content.data;
    return {
      identifier: request.identifier,
      reminderKey:
        typeof data?.reminderKey === 'string' ? data.reminderKey : undefined,
      source: typeof data?.source === 'string' ? data.source : undefined,
      taskId: typeof data?.taskId === 'string' ? data.taskId : undefined,
    };
  });
  return [...notifications, ...alarms];
}

export async function cancelTaskReminder(reminderId?: string): Promise<void> {
  if (Platform.OS === 'web' || !reminderId) return;
  try {
    if (isAlarmReminderId(reminderId)) {
      await cancelTaskAlarm(reminderId);
    } else {
      await Notifications.cancelScheduledNotificationAsync(reminderId);
    }
  } catch {
    // Reminder may already have fired or been removed by the OS.
  }
}

async function scheduleTaskNotification(
  task: Task,
  language: Language,
): Promise<string | undefined> {
  if (Platform.OS === 'web') return undefined;

  const triggerDate = getTaskReminderDate(task);
  if (!triggerDate || triggerDate.getTime() <= Date.now()) return undefined;

  try {
    const permission = await requestNotificationPermission(language);
    if (permission.state !== 'granted') return undefined;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: language === 'vi' ? 'Đến giờ rồi' : 'It’s time',
        body: `${task.startTime} · ${task.title}`,
        data: {
          reminderKey: getTaskReminderKey(task, language, 'notification'),
          source: TASK_REMINDER_SOURCE,
          taskId: task.id,
        },
        ...(Platform.OS === 'ios' && !isExpoGoRuntime()
          ? { sound: 'default' as const }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  } catch {
    return undefined;
  }
}

export async function scheduleTaskReminder(
  task: Task,
  language: Language = 'vi',
  preferredMode: ReminderDeliveryMode = 'notification',
): Promise<string | undefined> {
  if (preferredMode === 'alarm') {
    const readiness = await getTaskReminderReadiness(preferredMode, language);
    if (readiness.deliveryMode === 'alarm' && readiness.canSchedule) {
      try {
        const alarmId = await scheduleTaskAlarm(task, language, {
          reminderKey: getTaskReminderKey(task, language, 'alarm'),
          source: TASK_REMINDER_SOURCE,
          taskId: task.id,
        });
        if (alarmId) return alarmId;
      } catch {
        // Preserve the reminder by falling back to a standard notification.
      }
    }
  }

  return scheduleTaskNotification(task, language);
}
