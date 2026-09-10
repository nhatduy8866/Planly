import * as Notifications from 'expo-notifications';

import type { Language } from '../i18n/translations';
import type { Task } from '../types';
import {
  cancelTaskReminder,
  getNotificationPermission,
  getTaskReminderDate,
  getTaskReminderKey,
  scheduleTaskReminder,
  TASK_REMINDER_SOURCE,
  type NotificationPermissionSummary,
} from './notifications';

export interface NotificationIdUpdate {
  id: string;
  notificationId: string | undefined;
}

export interface ReminderReconciliationResult {
  canceled: number;
  errors: number;
  notificationIdUpdates: NotificationIdUpdate[];
  scheduled: number;
}

export interface ReminderReconciliationDependencies {
  cancelReminder(notificationId?: string): Promise<void>;
  getPermission(language: Language): Promise<NotificationPermissionSummary>;
  getScheduledReminders(): Promise<Notifications.NotificationRequest[]>;
  now(): number;
  scheduleReminder(task: Task, language: Language): Promise<string | undefined>;
}

const defaultDependencies: ReminderReconciliationDependencies = {
  cancelReminder: cancelTaskReminder,
  getPermission: getNotificationPermission,
  getScheduledReminders: Notifications.getAllScheduledNotificationsAsync,
  now: Date.now,
  scheduleReminder: scheduleTaskReminder,
};

function taskIdFromRequest(
  request: Notifications.NotificationRequest,
): string | undefined {
  const taskId = request.content.data?.taskId;
  if (typeof taskId !== 'string' || taskId.length === 0) return undefined;

  const source = request.content.data?.source;
  // Notifications created before reconciliation was introduced only had taskId.
  if (source !== undefined && source !== TASK_REMINDER_SOURCE) return undefined;
  return taskId;
}

function isCurrentReminder(
  request: Notifications.NotificationRequest,
  task: Task,
  language: Language,
): boolean {
  return (
    request.content.data?.source === TASK_REMINDER_SOURCE &&
    request.content.data?.reminderKey === getTaskReminderKey(task, language)
  );
}

function isEligibleForReminder(task: Task, now: number): boolean {
  const reminderDate = getTaskReminderDate(task);
  return !task.completed && reminderDate !== undefined && reminderDate.getTime() > now;
}

export async function reconcileTaskReminders(
  tasks: Task[],
  language: Language = 'vi',
  dependencies: ReminderReconciliationDependencies = defaultDependencies,
): Promise<ReminderReconciliationResult> {
  const result: ReminderReconciliationResult = {
    canceled: 0,
    errors: 0,
    notificationIdUpdates: [],
    scheduled: 0,
  };
  const [scheduledRequests, permission] = await Promise.all([
    dependencies.getScheduledReminders(),
    dependencies.getPermission(language),
  ]);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const requestsByTaskId = new Map<string, Notifications.NotificationRequest[]>();

  for (const request of scheduledRequests) {
    const taskId = taskIdFromRequest(request);
    if (!taskId) continue;
    const requests = requestsByTaskId.get(taskId) ?? [];
    requests.push(request);
    requestsByTaskId.set(taskId, requests);
  }

  const cancel = async (notificationId: string) => {
    try {
      await dependencies.cancelReminder(notificationId);
      result.canceled += 1;
    } catch {
      result.errors += 1;
    }
  };

  for (const [taskId, requests] of requestsByTaskId) {
    if (tasksById.has(taskId)) continue;
    for (const request of requests) await cancel(request.identifier);
  }

  for (const task of tasks) {
    const requests = requestsByTaskId.get(task.id) ?? [];
    if (!isEligibleForReminder(task, dependencies.now())) {
      for (const request of requests) await cancel(request.identifier);
      if (task.notificationId !== undefined) {
        result.notificationIdUpdates.push({ id: task.id, notificationId: undefined });
      }
      continue;
    }

    const currentRequests = requests.filter((request) =>
      isCurrentReminder(request, task, language),
    );
    const keptRequest =
      currentRequests.find(
        (request) => request.identifier === task.notificationId,
      ) ?? currentRequests[0];

    for (const request of requests) {
      if (request.identifier !== keptRequest?.identifier) {
        await cancel(request.identifier);
      }
    }

    if (keptRequest) {
      if (task.notificationId !== keptRequest.identifier) {
        result.notificationIdUpdates.push({
          id: task.id,
          notificationId: keptRequest.identifier,
        });
      }
      continue;
    }

    let notificationId: string | undefined;
    if (permission.state === 'granted') {
      try {
        notificationId = await dependencies.scheduleReminder(task, language);
        if (notificationId !== undefined) result.scheduled += 1;
      } catch {
        result.errors += 1;
      }
    }

    if (task.notificationId !== notificationId) {
      result.notificationIdUpdates.push({ id: task.id, notificationId });
    }
  }

  return result;
}
