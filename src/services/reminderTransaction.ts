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
 * Tasks are processed sequentially so an old reminder is always cancelled
 * before its replacement is scheduled.
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
  const preparedTasks: Task[] = [];

  for (const task of tasks) {
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

    preparedTasks.push({ ...taskWithoutOldReminder, notificationId });
  }

  return preparedTasks;
}
