import { describe, expect, it } from '@jest/globals';

import type { Task } from '../types';
import {
  assertNoTaskTimeConflicts,
  findTaskTimeConflict,
  TaskTimeConflictError,
} from './taskConflicts';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Họp nhóm',
    description: '',
    date: '2026-09-09',
    startTime: '09:00',
    reminderMinutes: 15,
    completed: false,
    order: 0,
    priority: 'medium',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('task time conflicts', () => {
  it('detects tasks with the same start time', () => {
    const existing = makeTask({ id: 'existing', title: 'Việc đã có' });
    const taskToSave = makeTask({ id: 'new-task', title: 'Việc mới' });

    expect(findTaskTimeConflict([taskToSave], [existing])).toEqual({
      task: taskToSave,
      conflictingTask: existing,
    });
  });

  it('allows tasks with different start times', () => {
    const existing = makeTask({
      id: 'existing',
      startTime: '09:00',
    });
    const taskToSave = makeTask({
      id: 'new-task',
      startTime: '09:30',
    });

    expect(findTaskTimeConflict([taskToSave], [existing])).toBeNull();
  });

  it('allows other start times, completed tasks, and tasks on other dates', () => {
    const taskToSave = makeTask({
      id: 'new-task',
      startTime: '10:00',
    });
    const existingTasks = [
      makeTask({ id: 'other-time' }),
      makeTask({ id: 'completed', startTime: '10:00', completed: true }),
      makeTask({ id: 'other-date', date: '2026-09-10', startTime: '10:00' }),
    ];

    expect(findTaskTimeConflict([taskToSave], existingTasks)).toBeNull();
  });

  it('does not compare an update with its own persisted version', () => {
    const existing = makeTask({ id: 'same-task', startTime: '09:00' });
    const update = makeTask({ id: 'same-task', startTime: '09:30' });

    expect(findTaskTimeConflict([update], [existing])).toBeNull();
  });

  it('detects conflicts between tasks created in the same save operation', () => {
    const first = makeTask({ id: 'first' });
    const second = makeTask({ id: 'second', startTime: '09:00' });

    expect(() => assertNoTaskTimeConflicts([first, second], [])).toThrow(
      TaskTimeConflictError,
    );
  });
});
