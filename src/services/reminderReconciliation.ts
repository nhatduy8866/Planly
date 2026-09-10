import type { Language } from '../i18n/translations';
import type {
  ReminderDeliveryMode,
  ScheduledTaskReminder,
  Task,
} from '../types';
import {
  cancelTaskReminder,
  getAllScheduledTaskReminders,
  getTaskReminderDate,
  getTaskReminderKey,
  getTaskReminderReadiness,
  scheduleTaskReminder,
  TASK_REMINDER_SOURCE,
  type TaskReminderReadiness,
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
  getReadiness(
    preferredMode: ReminderDeliveryMode,
    language: Language,
  ): Promise<TaskReminderReadiness>;
  getScheduledReminders(): Promise<ScheduledTaskReminder[]>;
  now(): number;
  scheduleReminder(
    task: Task,
    language: Language,
    deliveryMode: ReminderDeliveryMode,
  ): Promise<string | undefined>;
}

const defaultDependencies: ReminderReconciliationDependencies = {
  cancelReminder: cancelTaskReminder,
  getReadiness: getTaskReminderReadiness,
  getScheduledReminders: getAllScheduledTaskReminders,
  now: Date.now,
  scheduleReminder: scheduleTaskReminder,
};

function taskIdFromRequest(
  request: ScheduledTaskReminder,
): string | undefined {
  const taskId = request.taskId;
  if (typeof taskId !== 'string' || taskId.length === 0) return undefined;

  const source = request.source;
  // Notifications created before reconciliation was introduced only had taskId.
  if (source !== undefined && source !== TASK_REMINDER_SOURCE) return undefined;
  return taskId;
}

function isCurrentReminder(
  request: ScheduledTaskReminder,
  task: Task,
  language: Language,
  deliveryMode: ReminderDeliveryMode,
): boolean {
  return (
    request.source === TASK_REMINDER_SOURCE &&
    request.reminderKey === getTaskReminderKey(task, language, deliveryMode)
  );
}

function isEligibleForReminder(task: Task, now: number): boolean {
  const reminderDate = getTaskReminderDate(task);
  return !task.completed && reminderDate !== undefined && reminderDate.getTime() > now;
}

export async function reconcileTaskReminders(
  tasks: Task[],
  language: Language = 'vi',
  preferredMode: ReminderDeliveryMode = 'notification',
  dependencies: ReminderReconciliationDependencies = defaultDependencies,
): Promise<ReminderReconciliationResult> {
  const result: ReminderReconciliationResult = {
    canceled: 0,
    errors: 0,
    notificationIdUpdates: [],
    scheduled: 0,
  };
  const [scheduledRequests, readiness] = await Promise.all([
    dependencies.getScheduledReminders(),
    dependencies.getReadiness(preferredMode, language),
  ]);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const requestsByTaskId = new Map<string, ScheduledTaskReminder[]>();

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
      isCurrentReminder(request, task, language, readiness.deliveryMode),
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
    if (readiness.canSchedule) {
      try {
        notificationId = await dependencies.scheduleReminder(
          task,
          language,
          readiness.deliveryMode,
        );
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
