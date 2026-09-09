import type { Task } from '../types';
import { taskDateTime } from './date';

export type TaskListFilter = 'upcoming' | 'past' | 'all';

export function matchesTaskListFilter(
  task: Task,
  filter: TaskListFilter,
  currentTime: Date,
): boolean {
  const currentMinute = new Date(currentTime);
  currentMinute.setSeconds(0, 0);
  const scheduledTime = taskDateTime(task.date, task.startTime).getTime();

  if (filter === 'upcoming') {
    return (
      !task.completed &&
      scheduledTime >= currentMinute.getTime()
    );
  }
  if (filter === 'past') {
    return task.completed || scheduledTime < currentMinute.getTime();
  }
  return true;
}
