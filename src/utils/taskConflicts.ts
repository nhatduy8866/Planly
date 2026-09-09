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

function tasksHaveSameTime(first: Task, second: Task): boolean {
  return (
    first.date === second.date &&
    Boolean(first.startTime) &&
    first.startTime === second.startTime
  );
}

export function findTaskTimeConflict(
  tasksToSave: Task[],
  existingTasks: Task[],
): TaskTimeConflict | null {
  const taskIdsBeingSaved = new Set(tasksToSave.map((task) => task.id));
  const activeExistingTasks = existingTasks.filter(
    (task) => !task.completed && !taskIdsBeingSaved.has(task.id),
  );

  for (let taskIndex = 0; taskIndex < tasksToSave.length; taskIndex += 1) {
    const task = tasksToSave[taskIndex];
    if (task.completed) continue;

    const existingConflict = activeExistingTasks.find((existingTask) =>
      tasksHaveSameTime(task, existingTask),
    );
    if (existingConflict) {
      return { task, conflictingTask: existingConflict };
    }

    for (
      let previousIndex = 0;
      previousIndex < taskIndex;
      previousIndex += 1
    ) {
      const previousTask = tasksToSave[previousIndex];
      if (!previousTask.completed && tasksHaveSameTime(task, previousTask)) {
        return { task, conflictingTask: previousTask };
      }
    }
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
