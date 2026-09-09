import { describe, expect, it } from '@jest/globals';

import type { Task } from '../types';
import { buildTaskEdits, type TaskEditValues } from './taskEdits';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Họp nhóm',
    description: 'Chuẩn bị nội dung',
    date: '2026-09-09',
    startTime: '09:00',
    reminderMinutes: 15,
    notificationId: 'notification-1',
    batchId: 'batch-1',
    completed: false,
    order: 0,
    priority: 'medium',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function editValues(overrides: Partial<TaskEditValues> = {}): TaskEditValues {
  return {
    title: 'Họp nhóm',
    description: 'Chuẩn bị nội dung',
    date: '2026-09-09',
    startTime: '09:00',
    reminderMinutes: 15,
    priority: 'medium',
    ...overrides,
  };
}

describe('task edit utilities', () => {
  it('detaches a batch task when it is edited independently', () => {
    const existing = makeTask();
    const [result] = buildTaskEdits(
      [existing],
      existing,
      editValues({ title: 'Họp dự án' }),
      {
        applyToBatch: false,
        updatedAt: '2026-09-09T02:00:00.000Z',
      },
    );

    expect(result).toMatchObject({
      id: existing.id,
      title: 'Họp dự án',
      batchId: undefined,
      notificationId: undefined,
    });
  });

  it('keeps the batch link when the form is saved without any changes', () => {
    const existing = makeTask();
    const [result] = buildTaskEdits(
      [existing],
      existing,
      editValues(),
      {
        applyToBatch: false,
        updatedAt: '2026-09-09T02:00:00.000Z',
      },
    );

    expect(result.batchId).toBe('batch-1');
  });

  it('updates the whole batch and shifts every occurrence by the date change', () => {
    const first = makeTask({ id: 'task-1', completed: true });
    const second = makeTask({
      id: 'task-2',
      date: '2026-09-16',
      notificationId: 'notification-2',
    });
    const unrelated = makeTask({
      id: 'other-task',
      batchId: undefined,
      date: '2026-09-10',
      order: 3,
    });

    const result = buildTaskEdits(
      [first, second, unrelated],
      first,
      editValues({
        title: 'Họp dự án',
        date: '2026-09-10',
        startTime: '10:30',
      }),
      {
        applyToBatch: true,
        updatedAt: '2026-09-09T02:00:00.000Z',
      },
    );

    expect(result).toHaveLength(2);
    expect(result.map((task) => task.date)).toEqual([
      '2026-09-10',
      '2026-09-17',
    ]);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-1',
          title: 'Họp dự án',
          startTime: '10:30',
          batchId: 'batch-1',
          completed: true,
          order: 4,
        }),
        expect.objectContaining({
          id: 'task-2',
          title: 'Họp dự án',
          startTime: '10:30',
          batchId: 'batch-1',
        }),
      ]),
    );
  });
});
