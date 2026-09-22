import type { Task } from '../types';
import { timeToMinutes, toDateKey } from './date';

export type TaskListFilter = 'upcoming' | 'past' | 'all';

interface TaskFilterReference {
  date: string;
  minuteOfDay: number;
}

function taskFilterReference(date: Date): TaskFilterReference {
  return {
    date: toDateKey(date),
    minuteOfDay: date.getHours() * 60 + date.getMinutes(),
  };
}

function matchesTaskListFilterAtMinute(
  task: Task,
  filter: TaskListFilter,
  current: TaskFilterReference,
): boolean {
  if (filter === 'all') return true;

  const taskMinute = timeToMinutes(task.startTime);
  if (!Number.isFinite(taskMinute)) return filter === 'past' && task.completed;
  const isCurrentOrFuture =
    task.date > current.date ||
    (task.date === current.date && taskMinute >= current.minuteOfDay);

  if (filter === 'upcoming') {
    return !task.completed && isCurrentOrFuture;
  }
  return task.completed || !isCurrentOrFuture;
}

export function createTaskListFilter(
  filter: TaskListFilter,
  currentTime: Date,
): (task: Task) => boolean {
  const current = taskFilterReference(currentTime);
  return (task) => matchesTaskListFilterAtMinute(task, filter, current);
}

export function matchesTaskListFilter(
  task: Task,
  filter: TaskListFilter,
  currentTime: Date,
): boolean {
  return matchesTaskListFilterAtMinute(
    task,
    filter,
    taskFilterReference(currentTime),
  );
}
