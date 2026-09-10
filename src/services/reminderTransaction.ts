import type { Task } from '../types';
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
  language?: Language;
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
    language = 'vi',
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
        );
      } catch {
        // The old reminder is already gone, so do not persist its stale ID.
        notificationId = undefined;
      }

      return { ...taskWithoutOldReminder, notificationId };
    }),
  );
}
