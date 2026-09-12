import type {
  AlarmSchedulePreferences,
  ReminderDeliveryMode,
  Task,
} from '../types';
import type { Language } from '../i18n/translations';
import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from './notifications';

interface ReminderTransactionDependencies {
  cancelReminder: typeof cancelTaskReminder;
  scheduleReminder: typeof scheduleTaskReminder;
}

const defaultDependencies: ReminderTransactionDependencies = {
  cancelReminder: cancelTaskReminder,
  scheduleReminder: scheduleTaskReminder,
};

interface ReplaceTaskReminderOptions {
  alarmPreferences?: AlarmSchedulePreferences;
  language?: Language;
  reminderDeliveryMode?: ReminderDeliveryMode;
  dependencies?: ReminderTransactionDependencies;
}

/**
 * Replaces the reminder associated with every task before the tasks are saved.
 * Each task cancels its old reminder before scheduling the replacement. Tasks
 * are processed concurrently so large batches do not wait on each other.
 */
export async function replaceTaskReminders(
  tasks: Task[],
  existingTasks: Task[],
  options: ReplaceTaskReminderOptions = {},
): Promise<Task[]> {
  const {
    alarmPreferences = { vibrate: true },
    language = 'vi',
    reminderDeliveryMode = 'notification',
    dependencies = defaultDependencies,
  } = options;
  const existingById = new Map(existingTasks.map((task) => [task.id, task]));
  return Promise.all(
    tasks.map(async (task) => {
      const taskWithoutOldReminder = { ...task, notificationId: undefined };

      await dependencies.cancelReminder(
        existingById.get(task.id)?.notificationId,
      );

      let notificationId: string | undefined;
      try {
        notificationId = await dependencies.scheduleReminder(
          taskWithoutOldReminder,
          language,
          reminderDeliveryMode,
          alarmPreferences,
        );
      } catch {
        // The old reminder is already gone, so do not persist its stale ID.
        notificationId = undefined;
      }

      return { ...taskWithoutOldReminder, notificationId };
    }),
  );
}

/**
 * Rolls back a saved task batch. New reminders are cancelled, while reminders
 * belonging to updated tasks are replaced with freshly scheduled originals.
 */
export async function rollbackTaskReminders(
  savedTasks: Task[],
  previousTasks: Task[],
  options: ReplaceTaskReminderOptions = {},
): Promise<Task[]> {
  const { dependencies = defaultDependencies } = options;
  const previousIds = new Set(previousTasks.map((task) => task.id));

  await Promise.all(
    savedTasks
      .filter((task) => !previousIds.has(task.id))
      .map((task) => dependencies.cancelReminder(task.notificationId)),
  );

  return replaceTaskReminders(previousTasks, savedTasks, options);
}
