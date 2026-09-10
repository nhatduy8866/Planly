import type { SortDirection, Task } from '../types';
import { timeToMinutes } from './date';

export type TaskSortKey = 'time' | 'priority' | 'title' | 'created';
export type { SortDirection } from '../types';

export interface TaskSortState<T extends TaskSortKey = TaskSortKey> {
  direction: SortDirection;
  key: T;
}

const PRIORITY_WEIGHT: Record<NonNullable<Task['priority']>, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function getDefaultTaskSortDirection(key: TaskSortKey): SortDirection {
  return key === 'priority' || key === 'created'
    ? 'descending'
    : 'ascending';
}

export function nextTaskSortState<T extends TaskSortKey>(
  current: TaskSortState<T>,
  nextKey: T,
): TaskSortState<T> {
  if (current.key !== nextKey) {
    return {
      direction: getDefaultTaskSortDirection(nextKey),
      key: nextKey,
    };
  }

  return {
    direction:
      current.direction === 'ascending' ? 'descending' : 'ascending',
    key: current.key,
  };
}

interface CompareTaskOptions {
  includeDate?: boolean;
}

export function compareTasks(
  first: Task,
  second: Task,
  key: TaskSortKey,
  direction: SortDirection,
  locale: string,
  { includeDate = false }: CompareTaskOptions = {},
): number {
  const directionMultiplier = direction === 'ascending' ? 1 : -1;

  if (includeDate) {
    const dateComparison = first.date.localeCompare(second.date);
    if (dateComparison !== 0) {
      return key === 'time'
        ? dateComparison * directionMultiplier
        : dateComparison;
    }
  }

  let primaryComparison = 0;
  if (key === 'priority') {
    primaryComparison =
      PRIORITY_WEIGHT[first.priority ?? 'none'] -
      PRIORITY_WEIGHT[second.priority ?? 'none'];
  } else if (key === 'title') {
    primaryComparison = first.title.localeCompare(second.title, locale);
  } else if (key === 'created') {
    primaryComparison = first.createdAt.localeCompare(second.createdAt);
  } else {
    primaryComparison =
      timeToMinutes(first.startTime) - timeToMinutes(second.startTime);
  }

  if (primaryComparison !== 0) {
    return primaryComparison * directionMultiplier;
  }

  const timeComparison =
    timeToMinutes(first.startTime) - timeToMinutes(second.startTime);
  if (timeComparison !== 0) {
    return key === 'time'
      ? timeComparison * directionMultiplier
      : timeComparison;
  }

  return (
    (first.order ?? 0) - (second.order ?? 0) ||
    first.createdAt.localeCompare(second.createdAt) ||
    first.id.localeCompare(second.id)
  );
}
