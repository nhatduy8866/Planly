import type { Task } from '../types';

export interface TaskTimeConflict {
  task: Task;
  conflictingTask: Task;
}

export class TaskTimeConflictError extends Error {
  readonly conflict: TaskTimeConflict;

  constructor(conflict: TaskTimeConflict) {
    super('TASK_TIME_CONFLICT');
    this.name = 'TaskTimeConflictError';
    this.conflict = conflict;
  }
}

function taskTimeKey(task: Task): string | undefined {
  return task.startTime ? `${task.date}\u0000${task.startTime}` : undefined;
}

export function findTaskTimeConflict(
  tasksToSave: Task[],
  existingTasks: Task[],
): TaskTimeConflict | null {
  const taskIdsBeingSaved = new Set(tasksToSave.map((task) => task.id));
  const occupiedTimes = new Map<string, Task>();

  for (const task of existingTasks) {
    if (task.completed || taskIdsBeingSaved.has(task.id)) continue;
    const key = taskTimeKey(task);
    if (key && !occupiedTimes.has(key)) occupiedTimes.set(key, task);
  }

  for (const task of tasksToSave) {
    if (task.completed) continue;

    const key = taskTimeKey(task);
    if (!key) continue;
    const conflictingTask = occupiedTimes.get(key);
    if (conflictingTask) return { task, conflictingTask };
    occupiedTimes.set(key, task);
  }

  return null;
}

export function assertNoTaskTimeConflicts(
  tasksToSave: Task[],
  existingTasks: Task[],
): void {
  const conflict = findTaskTimeConflict(tasksToSave, existingTasks);
  if (conflict) throw new TaskTimeConflictError(conflict);
}
