import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import type {
  AlarmPermissionResponse,
  ScheduledAlarm,
} from 'react-native-alarm-scheduler';

import type { Language } from '../i18n/translations';
import type { ScheduledTaskReminder, Task } from '../types';
import { taskDateTime } from '../utils/date';

const ALARM_REMINDER_ID_PREFIX = 'alarm:';
const ALARM_MAX_RING_DURATION_SECONDS = 5 * 60;

type AlarmSchedulerApi = typeof import('react-native-alarm-scheduler')['default'];

export interface AlarmPermissionSummary {
  available: boolean;
  canOpenSettings: boolean;
  canPostNotifications: boolean;
  canScheduleExactAlarms: boolean;
  canUseFullScreenIntent: boolean;
  state: 'denied' | 'granted' | 'unsupported';
}

function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

let alarmSchedulerPromise: Promise<AlarmSchedulerApi | undefined> | undefined;

async function loadAlarmScheduler(): Promise<AlarmSchedulerApi | undefined> {
  if (Platform.OS === 'web' || isExpoGo()) return undefined;

  if (!alarmSchedulerPromise) {
    alarmSchedulerPromise = Promise.resolve().then(() => {
      try {
        // Expo Go does not contain this native module. Keep the import lazy so
        // standard notifications remain usable there.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const module = require('react-native-alarm-scheduler') as typeof import('react-native-alarm-scheduler');
        return module.default;
      } catch {
        return undefined;
      }
    });
  }
  return alarmSchedulerPromise;
}

function unavailablePermission(): AlarmPermissionSummary {
  return {
    available: false,
    canOpenSettings: false,
    canPostNotifications: false,
    canScheduleExactAlarms: false,
    canUseFullScreenIntent: false,
    state: 'unsupported',
  };
}

function summarizePermission(
  permission: AlarmPermissionResponse,
): AlarmPermissionSummary {
  const granted =
    permission.status === 'authorized' && permission.canScheduleExactAlarms;
  return {
    available: permission.status !== 'unavailable',
    canOpenSettings: permission.canOpenSettings,
    canPostNotifications: permission.canPostNotifications ?? true,
    canScheduleExactAlarms: permission.canScheduleExactAlarms,
    canUseFullScreenIntent: permission.canUseFullScreenIntent ?? true,
    state: granted ? 'granted' : 'denied',
  };
}

export function isAlarmReminderId(reminderId?: string): boolean {
  return Boolean(reminderId?.startsWith(ALARM_REMINDER_ID_PREFIX));
}

function nativeAlarmId(reminderId: string): string {
  return reminderId.slice(ALARM_REMINDER_ID_PREFIX.length);
}

function storedAlarmId(alarmId: string): string {
  return `${ALARM_REMINDER_ID_PREFIX}${alarmId}`;
}

export async function getAlarmPermission(): Promise<AlarmPermissionSummary> {
  const scheduler = await loadAlarmScheduler();
  if (!scheduler) return unavailablePermission();

  try {
    return summarizePermission(await scheduler.getPermissionsAsync());
  } catch {
    return unavailablePermission();
  }
}

export async function requestAlarmPermission(): Promise<AlarmPermissionSummary> {
  const scheduler = await loadAlarmScheduler();
  if (!scheduler) return unavailablePermission();

  try {
    return summarizePermission(await scheduler.requestPermissionsAsync());
  } catch {
    return unavailablePermission();
  }
}

export async function openAlarmSettings(): Promise<boolean> {
  const scheduler = await loadAlarmScheduler();
  return scheduler ? scheduler.openAlarmSettingsAsync().catch(() => false) : false;
}

export async function openFullScreenAlarmSettings(): Promise<boolean> {
  const scheduler = await loadAlarmScheduler();
  return scheduler
    ? scheduler.openFullScreenIntentSettingsAsync().catch(() => false)
    : false;
}

export async function scheduleTaskAlarm(
  task: Task,
  language: Language,
  metadata: Record<string, string>,
): Promise<string | undefined> {
  if (task.reminderMinutes === null) return undefined;

  const triggerDate = taskDateTime(task.date, task.startTime);
  if (triggerDate.getTime() <= Date.now()) return undefined;

  const scheduler = await loadAlarmScheduler();
  if (!scheduler) return undefined;

  const permission = summarizePermission(await scheduler.getPermissionsAsync());
  if (
    !permission.canScheduleExactAlarms ||
    (Platform.OS === 'android' && !permission.canPostNotifications)
  ) {
    return undefined;
  }

  const alertTitle = language === 'vi' ? 'Đến giờ rồi' : 'It’s time';
  const alertBody = `${task.startTime} · ${task.title}`;
  const stopButtonTitle = language === 'vi' ? 'Tắt' : 'Stop';
  const openButtonTitle = language === 'vi' ? 'Mở Planly' : 'Open Planly';

  const alarm = await scheduler.scheduleAlarmAsync({
    android: {
      alertBody,
      fullScreen: true,
      fullScreenTarget: 'native',
      launchUri: 'planly://',
      maxRingDurationSeconds: ALARM_MAX_RING_DURATION_SECONDS,
      vibrate: true,
    },
    hour: triggerDate.getHours(),
    ios: {
      alertActionMode: 'default',
      alertTitle,
      metadata,
      secondaryButtonBehavior: 'openApp',
      secondaryButtonTitle: openButtonTitle,
      stopButtonTitle,
      stopIntentBehavior: 'recordOnly',
    },
    minute: triggerDate.getMinutes(),
    timestamp: triggerDate.getTime(),
    title: task.title,
  });

  return storedAlarmId(alarm.id);
}

export async function cancelTaskAlarm(reminderId: string): Promise<void> {
  if (!isAlarmReminderId(reminderId)) return;
  const scheduler = await loadAlarmScheduler();
  if (!scheduler) return;
  await scheduler.cancelAlarmAsync(nativeAlarmId(reminderId));
}

function alarmMetadata(alarm: ScheduledAlarm): Record<string, unknown> {
  return alarm.metadata ?? {};
}

export async function getScheduledTaskAlarms(): Promise<
  ScheduledTaskReminder[]
> {
  const scheduler = await loadAlarmScheduler();
  if (!scheduler) return [];

  const alarms = await scheduler.getScheduledAlarmsAsync();
  return alarms.map((alarm) => {
    const metadata = alarmMetadata(alarm);
    return {
      identifier: storedAlarmId(alarm.id),
      reminderKey:
        typeof metadata.reminderKey === 'string'
          ? metadata.reminderKey
          : undefined,
      source: typeof metadata.source === 'string' ? metadata.source : undefined,
      taskId: typeof metadata.taskId === 'string' ? metadata.taskId : undefined,
    };
  });
}

interface PendingTaskAlarm {
  alarmId: string;
  taskId?: string;
}

export async function consumePendingTaskAlarm(): Promise<
  PendingTaskAlarm | undefined
> {
  const scheduler = await loadAlarmScheduler();
  if (!scheduler) return undefined;

  const handoff = await scheduler.getPendingNativeAlarmHandoffAsync();
  const context = await scheduler.getCurrentAlarmContextAsync();
  if (!handoff && context?.state !== 'alerting') return undefined;

  const alarmId = handoff?.alarmId ?? context?.id;
  if (!alarmId) return undefined;

  let metadata = context?.metadata;
  if (!metadata) {
    const scheduled = await scheduler.getScheduledAlarmsAsync();
    metadata = scheduled.find((alarm) => alarm.id === alarmId)?.metadata;
  }
  const taskId =
    typeof metadata?.taskId === 'string' ? metadata.taskId : undefined;

  await scheduler.completeNativeAlarmAsync(alarmId);
  await scheduler.clearPendingNativeAlarmHandoffAsync();
  return { alarmId, taskId };
}
