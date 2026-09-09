import { describe, expect, it } from '@jest/globals';

import type { Task } from '../types';
import { matchesTaskListFilter } from './taskFilters';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Công việc',
    description: '',
    date: '2026-09-09',
    startTime: '09:00',
    reminderMinutes: 0,
    completed: false,
    order: 0,
    createdAt: '2026-09-09T00:00:00.000Z',
    updatedAt: '2026-09-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('task list filters', () => {
  const currentTime = new Date(2026, 8, 9, 10, 30, 45);

  it('shows only incomplete tasks from the current minute onward as upcoming', () => {
    expect(
      matchesTaskListFilter(
        task({ startTime: '10:30' }),
        'upcoming',
        currentTime,
      ),
    ).toBe(true);
    expect(
      matchesTaskListFilter(
        task({ date: '2026-09-10' }),
        'upcoming',
        currentTime,
      ),
    ).toBe(true);
    expect(
      matchesTaskListFilter(
        task({ startTime: '10:29' }),
        'upcoming',
        currentTime,
      ),
    ).toBe(false);
    expect(
      matchesTaskListFilter(
        task({ completed: true }),
        'upcoming',
        currentTime,
      ),
    ).toBe(false);
  });

  it('shows completed tasks and overdue tasks in the past filter', () => {
    expect(
      matchesTaskListFilter(
        task({ completed: true, date: '2026-09-10' }),
        'past',
        currentTime,
      ),
    ).toBe(true);
    expect(
      matchesTaskListFilter(
        task({ completed: false, startTime: '10:29' }),
        'past',
        currentTime,
      ),
    ).toBe(true);
    expect(
      matchesTaskListFilter(
        task({ completed: false, startTime: '10:30' }),
        'past',
        currentTime,
      ),
    ).toBe(false);
  });

  it('shows every task in the all filter', () => {
    expect(
      matchesTaskListFilter(
        task({ completed: true, date: '2020-01-01' }),
        'all',
        currentTime,
      ),
    ).toBe(true);
  });
});
