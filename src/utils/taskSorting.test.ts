import { describe, expect, it } from '@jest/globals';

import type { Task } from '../types';
import {
  compareTasks,
  nextTaskSortState,
  type SortDirection,
  type TaskSortKey,
} from './taskSorting';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: '',
    date: '2026-09-10',
    startTime: '09:00',
    reminderMinutes: null,
    completed: false,
    order: 0,
    priority: 'none',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  };
}

function sortedIds(
  tasks: Task[],
  key: TaskSortKey,
  direction: SortDirection,
  includeDate = false,
): string[] {
  return [...tasks]
    .sort((first, second) =>
      compareTasks(first, second, key, direction, 'vi-VN', { includeDate }),
    )
    .map((item) => item.id);
}

describe('task sorting', () => {
  it('places a newly appended task at its chronological position', () => {
    const tasks = [
      task('15:30', { startTime: '15:30', order: 0 }),
      task('19:30', { startTime: '19:30', order: 1 }),
      task('15:31-new', { startTime: '15:31', order: 2 }),
    ];

    expect(sortedIds(tasks, 'time', 'ascending')).toEqual([
      '15:30',
      '15:31-new',
      '19:30',
    ]);
    expect(sortedIds(tasks, 'time', 'descending')).toEqual([
      '19:30',
      '15:31-new',
      '15:30',
    ]);
  });

  it('reverses date and time together for the Tasks tab', () => {
    const tasks = [
      task('today-late', { startTime: '19:30' }),
      task('tomorrow-early', { date: '2026-09-11', startTime: '08:00' }),
      task('today-early', { startTime: '15:30' }),
    ];

    expect(sortedIds(tasks, 'time', 'ascending', true)).toEqual([
      'today-early',
      'today-late',
      'tomorrow-early',
    ]);
    expect(sortedIds(tasks, 'time', 'descending', true)).toEqual([
      'tomorrow-early',
      'today-late',
      'today-early',
    ]);
  });

  it('supports both directions for priority, title, and creation time', () => {
    const tasks = [
      task('low', {
        createdAt: '2026-09-10T08:00:00.000Z',
        priority: 'low',
        title: 'Báo cáo',
      }),
      task('high', {
        createdAt: '2026-09-10T10:00:00.000Z',
        priority: 'high',
        title: 'Ăn sáng',
      }),
    ];

    expect(sortedIds(tasks, 'priority', 'descending')).toEqual(['high', 'low']);
    expect(sortedIds(tasks, 'priority', 'ascending')).toEqual(['low', 'high']);
    expect(sortedIds(tasks, 'title', 'ascending')).toEqual(['high', 'low']);
    expect(sortedIds(tasks, 'title', 'descending')).toEqual(['low', 'high']);
    expect(sortedIds(tasks, 'created', 'descending')).toEqual(['high', 'low']);
    expect(sortedIds(tasks, 'created', 'ascending')).toEqual(['low', 'high']);
  });

  it('toggles the selected option and resets a new option to its default', () => {
    expect(
      nextTaskSortState(
        { direction: 'ascending', key: 'time' },
        'time',
      ),
    ).toEqual({ direction: 'descending', key: 'time' });
    expect(
      nextTaskSortState(
        { direction: 'descending', key: 'time' },
        'title',
      ),
    ).toEqual({ direction: 'ascending', key: 'title' });
    expect(
      nextTaskSortState(
        { direction: 'ascending', key: 'title' },
        'priority',
      ),
    ).toEqual({ direction: 'descending', key: 'priority' });
  });
});
