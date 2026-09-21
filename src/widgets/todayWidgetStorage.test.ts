import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  consumeTodayWidgetCompletionQueue,
  queueTodayWidgetCompletion,
  readTodayWidgetCompletions,
  removeTodayWidgetCompletion,
} from './todayWidgetStorage';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

describe('today widget completion storage', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('keeps the latest completion for each task', async () => {
    await queueTodayWidgetCompletion({
      completedAt: '2026-09-13T08:00:00.000Z',
      taskId: 'task-1',
      undoUntil: 1_000,
    });
    await queueTodayWidgetCompletion({
      completedAt: '2026-09-13T08:05:00.000Z',
      taskId: 'task-1',
      undoUntil: 2_000,
    });

    expect(await readTodayWidgetCompletions()).toEqual([
      {
        completedAt: '2026-09-13T08:05:00.000Z',
        taskId: 'task-1',
        undoUntil: 2_000,
      },
    ]);
  });

  it('removes completions after the app consumes them', async () => {
    const completion = {
      completedAt: '2026-09-13T08:05:00.000Z',
      taskId: 'task-1',
      undoUntil: 1_000,
    };
    await queueTodayWidgetCompletion(completion);

    expect(await consumeTodayWidgetCompletionQueue(1_000)).toEqual({
      active: [],
      ready: [completion],
    });
    expect(await readTodayWidgetCompletions()).toEqual([]);
  });

  it('keeps a completion reversible until its undo window expires', async () => {
    const completion = {
      completedAt: '2026-09-13T08:05:00.000Z',
      taskId: 'task-1',
      undoUntil: 6_000,
    };
    await queueTodayWidgetCompletion(completion);

    expect(await consumeTodayWidgetCompletionQueue(5_999)).toEqual({
      active: [completion],
      ready: [],
    });
    await removeTodayWidgetCompletion(completion.taskId);
    expect(await readTodayWidgetCompletions()).toEqual([]);
  });
});
