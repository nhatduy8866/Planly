import { describe, expect, it } from '@jest/globals';

import type { Task } from '../types';
import { filterScheduleTasksForView } from './scheduleTasks';

function createTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: '',
    date: '2026-09-08',
    startTime: '10:00',
    durationMinutes: 30,
    reminderMinutes: null,
    completed: false,
    order: 0,
    createdAt: `2026-09-08T00:00:0${id.length}.000Z`,
    updatedAt: `2026-09-08T00:00:0${id.length}.000Z`,
    ...overrides,
  };
}

describe('schedule task views', () => {
  const now = new Date(2026, 8, 8, 10, 0, 30);
  const tasks = [
    createTask('past', { startTime: '09:59' }),
    createTask('later', { startTime: '11:00' }),
    createTask('now'),
    createTask('completed-future', { completed: true, startTime: '12:00' }),
    createTask('completed-past', { completed: true, startTime: '08:00' }),
    createTask('another-day', { date: '2026-09-09', startTime: '07:00' }),
  ];

  it('shows only incomplete tasks that have not started yet', () => {
    expect(
      filterScheduleTasksForView(tasks, '2026-09-08', 'upcoming', now).map(
        (task) => task.id,
      ),
    ).toEqual(['later']);
  });

  it('shows tasks that are completed or past their start time', () => {
    expect(
      filterScheduleTasksForView(tasks, '2026-09-08', 'past', now).map(
        (task) => task.id,
      ),
    ).toEqual(['past', 'now', 'completed-future', 'completed-past']);
  });

  it('does not show incomplete tasks from a past selected day as upcoming', () => {
    expect(
      filterScheduleTasksForView(
        [createTask('yesterday', { date: '2026-09-07', startTime: '23:59' })],
        '2026-09-07',
        'upcoming',
        now,
      ),
    ).toEqual([]);
  });

  it('shows every task for the selected day in the all view', () => {
    expect(
      filterScheduleTasksForView(tasks, '2026-09-08', 'all', now).map(
        (task) => task.id,
      ),
    ).toEqual([
      'past',
      'later',
      'now',
      'completed-future',
      'completed-past',
    ]);
  });
});
