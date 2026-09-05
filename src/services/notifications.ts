import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Task } from '../types';
import { taskDateTime } from '../utils/date';

const CHANNEL_ID = 'planly-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Nhắc lịch Planly',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 150, 200],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelTaskReminder(notificationId?: string): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Notification may already have fired or been removed by the OS.
  }
}

export async function scheduleTaskReminder(
  task: Task,
): Promise<string | undefined> {
  if (task.reminderMinutes === null) return undefined;

  const triggerDate = taskDateTime(task.date, task.startTime);
  triggerDate.setMinutes(triggerDate.getMinutes() - task.reminderMinutes);
  if (triggerDate.getTime() <= Date.now()) return undefined;
  if (!(await ensurePermission())) return undefined;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: task.reminderMinutes === 0 ? 'Đến giờ rồi' : 'Sắp đến lịch',
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
