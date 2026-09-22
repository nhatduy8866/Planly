import type { Task } from '../types';

type SyncedTaskData = Omit<Task, 'notificationId'>;

export function haveSameSyncedTaskData(
  left: SyncedTaskData,
  right: SyncedTaskData,
): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.description === right.description &&
    left.date === right.date &&
    left.startTime === right.startTime &&
    left.color === right.color &&
    left.batchId === right.batchId &&
    left.completed === right.completed &&
    left.order === right.order &&
    left.priority === right.priority &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt
  );
}

export function haveSameTaskData(left: Task, right: Task): boolean {
  return (
    left.notificationId === right.notificationId &&
    haveSameSyncedTaskData(left, right)
  );
}

export function haveSameTaskLists(left: Task[], right: Task[]): boolean {
  return (
    left.length === right.length &&
    left.every((task, index) => haveSameTaskData(task, right[index]))
  );
}
