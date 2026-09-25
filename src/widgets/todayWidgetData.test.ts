import { describe, expect, it, jest } from '@jest/globals';

import type { Task } from '../types';
import {
  applyTodayWidgetCompletions,
  completeTodayWidgetSnapshot,
  createTodayWidgetSnapshot,
  getNextTodayWidgetRefreshTime,
  TODAY_WIDGET_UNDO_WINDOW_MS,
  undoTodayWidgetSnapshotCompletion,
} from './todayWidgetData';
import {
  parseWidgetCompletions,
  parseWidgetLanguage,
  parseWidgetTasks,
  parseWidgetTheme,
} from './todayWidgetStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
  },
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    completed: false,
    createdAt: '2026-09-13T00:00:00.000Z',
    date: '2026-09-13',
    description: '',
    id: 'task-1',
    order: 0,
    startTime: '09:00',
    title: 'Họp nhóm',
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('today widget data', () => {
  it('selects the next upcoming task and counts the full day', () => {
    const snapshot = createTodayWidgetSnapshot(
      [
        makeTask({ id: 'later', completed: true, startTime: '14:30' }),
        makeTask({ id: 'tomorrow', date: '2026-09-14' }),
        makeTask({ id: 'earlier', startTime: '08:15', color: '#34D399' }),
        makeTask({ id: 'middle', startTime: '09:30' }),
        makeTask({ id: 'past', startTime: '07:45' }),
      ],
      'vi',
      new Date(2026, 8, 13, 8),
      'dark',
    );

    expect(snapshot.tasks.map((task) => task.id)).toEqual(['earlier']);
    expect(snapshot.tasks[0].color).toBe('#34D399');
    expect(snapshot.completedCount).toBe(1);
    expect(snapshot.totalCount).toBe(4);
    expect(snapshot.upcomingCount).toBe(2);
    expect(snapshot.pendingCompletions).toEqual([]);
    expect(snapshot.theme).toBe('dark');
    expect(snapshot.todayLabel).toBe('Hôm nay');
    expect(snapshot.undoLabel).toBe('Chạm để hoàn tác');
  });

  it('records an interactive completion and updates its widget state', () => {
    const snapshot = createTodayWidgetSnapshot(
      [makeTask({ id: 'interactive-task', startTime: '09:30' })],
      'vi',
      new Date(2026, 8, 13, 8),
    );
    const completedAt = '2026-09-13T08:05:00.000Z';
    const completedSnapshot = completeTodayWidgetSnapshot(
      snapshot,
      'interactive-task',
      completedAt,
    );

    expect(completedSnapshot.tasks[0].completed).toBe(true);
    expect(completedSnapshot.pendingCompletions).toEqual([
      {
        completedAt,
        taskId: 'interactive-task',
        undoUntil: Date.parse(completedAt) + TODAY_WIDGET_UNDO_WINDOW_MS,
      },
    ]);
    expect(completedSnapshot.completedCount).toBe(1);
    expect(completedSnapshot.upcomingCount).toBe(0);

    const revertedSnapshot = undoTodayWidgetSnapshotCompletion(
      completedSnapshot,
      'interactive-task',
      Date.parse(completedAt) + TODAY_WIDGET_UNDO_WINDOW_MS - 1,
    );
    expect(revertedSnapshot.tasks[0].completed).toBe(false);
    expect(revertedSnapshot.pendingCompletions).toEqual([]);
    expect(revertedSnapshot.completedCount).toBe(0);
    expect(revertedSnapshot.upcomingCount).toBe(1);
    expect(
      undoTodayWidgetSnapshotCompletion(
        completedSnapshot,
        'interactive-task',
        Date.parse(completedAt) + TODAY_WIDGET_UNDO_WINDOW_MS,
      ),
    ).toBe(completedSnapshot);
  });

  it('applies widget completions to app tasks', () => {
    const source = makeTask({
      id: 'completed-from-widget',
      notificationId: 'notification-1',
    });
    const completedAt = '2026-09-13T08:05:00.000Z';
    const tasks = applyTodayWidgetCompletions(
      [source, makeTask({ id: 'untouched' })],
      [{ completedAt, taskId: source.id, undoUntil: Date.parse(completedAt) }],
    );

    expect(tasks[0]).toEqual({
      ...source,
      completed: true,
      notificationId: undefined,
      updatedAt: completedAt,
    });
    expect(tasks[1].id).toBe('untouched');
  });

  it('keeps the snapshot compact while preserving the full task count', () => {
    const tasks = Array.from({ length: 10 }, (_, index) =>
      makeTask({
        id: `task-${index}`,
        order: index,
        startTime: `${String(index + 8).padStart(2, '0')}:00`,
      }),
    );

    const snapshot = createTodayWidgetSnapshot(
      tasks,
      'en',
      new Date(2026, 8, 13, 7),
    );

    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.totalCount).toBe(10);
    expect(snapshot.upcomingCount).toBe(10);
    expect(snapshot.todayLabel).toBe('Today');
  });

  it('expires the current task at its exact start time', () => {
    const tasks = [makeTask({ id: 'starts-now', startTime: '15:00' })];
    const atStart = new Date(2026, 8, 13, 15, 0, 0);

    expect(
      createTodayWidgetSnapshot(tasks, 'vi', atStart).tasks,
    ).toEqual([]);
  });

  it('schedules the next native refresh for the next task boundary', () => {
    const now = new Date(2026, 8, 13, 14, 30, 0);
    const tasks = [
      makeTask({ id: 'later', startTime: '16:00' }),
      makeTask({ id: 'next', startTime: '15:00' }),
      makeTask({ completed: true, id: 'completed', startTime: '14:45' }),
    ];

    expect(getNextTodayWidgetRefreshTime(tasks, now)).toBe(
      new Date(2026, 8, 13, 15, 0, 0).getTime(),
    );
    expect(getNextTodayWidgetRefreshTime([], now)).toBe(
      new Date(2026, 8, 14, 0, 0, 0).getTime(),
    );
  });

  it('falls back safely when stored widget data is invalid', () => {
    expect(parseWidgetTasks('{invalid json')).toEqual([]);
    expect(parseWidgetTasks(JSON.stringify([{ title: 'Missing fields' }]))).toEqual([]);
    expect(parseWidgetLanguage(JSON.stringify({ language: 'en' }))).toBe('en');
    expect(parseWidgetLanguage(JSON.stringify({ language: 'fr' }))).toBe('vi');
    expect(parseWidgetTheme(JSON.stringify({ theme: 'dark' }))).toBe('dark');
    expect(parseWidgetTheme(JSON.stringify({ theme: 'sepia' }))).toBe('light');
    expect(parseWidgetCompletions('{invalid json')).toEqual([]);
    expect(
      parseWidgetCompletions(
        JSON.stringify([
          {
            completedAt: '2026-09-13T08:05:00.000Z',
            taskId: 'task-1',
            undoUntil: Date.parse('2026-09-13T08:05:05.000Z'),
          },
          {
            completedAt: 'not-a-date',
            taskId: 'task-2',
            undoUntil: 0,
          },
        ]),
      ),
    ).toEqual([
      {
        completedAt: '2026-09-13T08:05:00.000Z',
        taskId: 'task-1',
        undoUntil: Date.parse('2026-09-13T08:05:05.000Z'),
      },
    ]);
  });
});
