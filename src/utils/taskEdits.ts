import type { Task, TaskPriority } from '../types';
import { addDays, fromDateKey, toDateKey } from './date';

export type TaskEditValues = Pick<
  Task,
  'title' | 'description' | 'date' | 'startTime' | 'reminderMinutes'
> & { priority: TaskPriority; color?: string };

interface BuildTaskEditsOptions {
  applyToBatch: boolean;
  updatedAt: string;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function dateKeyDayNumber(dateKey: string): number {
  const date = fromDateKey(dateKey);
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
      MILLISECONDS_PER_DAY,
  );
}

function shiftDateKey(dateKey: string, days: number): string {
  return toDateKey(addDays(fromDateKey(dateKey), days));
}

export function hasTaskEditChanges(
  task: Task,
  values: TaskEditValues,
): boolean {
  return (
    task.title !== values.title ||
    task.description !== values.description ||
    task.date !== values.date ||
    task.startTime !== values.startTime ||
    task.reminderMinutes !== values.reminderMinutes ||
    task.color !== values.color ||
    (task.priority ?? 'none') !== values.priority
  );
}

export function buildTaskEdits(
  allTasks: Task[],
  existing: Task,
  values: TaskEditValues,
  { applyToBatch, updatedAt }: BuildTaskEditsOptions,
): Task[] {
  const editsWholeBatch = Boolean(applyToBatch && existing.batchId);
  const matchingBatchTasks = editsWholeBatch
    ? allTasks.filter((task) => task.batchId === existing.batchId)
    : [];
  const sourceTasks = matchingBatchTasks.length
    ? matchingBatchTasks
    : [existing];
  const editedTaskIds = new Set(sourceTasks.map((task) => task.id));
  const nextOrderByDate = new Map<string, number>();

  for (const task of allTasks) {
    if (editedTaskIds.has(task.id)) continue;
    nextOrderByDate.set(
      task.date,
      Math.max(nextOrderByDate.get(task.date) ?? -1, task.order ?? 0),
    );
  }

  const dateShift = editsWholeBatch
    ? dateKeyDayNumber(values.date) - dateKeyDayNumber(existing.date)
    : 0;
  const detachesFromBatch =
    !editsWholeBatch && hasTaskEditChanges(existing, values);

  return sourceTasks.map((source) => {
    const targetDate = editsWholeBatch
      ? shiftDateKey(source.date, dateShift)
      : values.date;
    let order = source.order ?? 0;

    if (targetDate !== source.date) {
      order = (nextOrderByDate.get(targetDate) ?? -1) + 1;
      nextOrderByDate.set(targetDate, order);
    }

    return {
      ...source,
      title: values.title,
      description: values.description,
      date: targetDate,
      startTime: values.startTime,
      reminderMinutes: values.reminderMinutes,
      color: values.color,
      priority: values.priority,
      notificationId: undefined,
      batchId: detachesFromBatch ? undefined : source.batchId,
      order,
      updatedAt,
    };
  });
}
