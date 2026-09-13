import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Task } from '../../types';
import {
  enqueueSyncMutations,
  readSyncOutbox,
  removeProcessedSyncMutations,
} from './outbox';
import { createTaskUpsertMutation } from './types';

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

const task: Task = {
  completed: false,
  createdAt: '2026-09-13T01:00:00.000Z',
  date: '2026-09-14',
  description: '',
  id: 'task-1',
  order: 0,
  reminderMinutes: null,
  startTime: '09:00',
  title: 'Task',
  updatedAt: '2026-09-13T01:00:00.000Z',
};

describe('sync outbox', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('coalesces changes to the same record for one account', async () => {
    const first = createTaskUpsertMutation(
      task,
      '2026-09-13T02:00:00.000Z',
      'user-1',
    );
    const latest = createTaskUpsertMutation(
      { ...task, title: 'Latest' },
      '2026-09-13T03:00:00.000Z',
      'user-1',
    );

    await enqueueSyncMutations([first]);
    await enqueueSyncMutations([latest]);

    expect(await readSyncOutbox('user-1')).toEqual([latest]);
  });

  it('keeps mutations isolated between accounts', async () => {
    const userOne = createTaskUpsertMutation(task, undefined, 'user-1');
    const userTwo = createTaskUpsertMutation(task, undefined, 'user-2');

    await enqueueSyncMutations([userOne, userTwo]);

    expect(await readSyncOutbox('user-1')).toEqual([userOne]);
    expect(await readSyncOutbox('user-2')).toEqual([userTwo]);
  });

  it('does not remove a newer change while acknowledging an older request', async () => {
    const older = createTaskUpsertMutation(
      task,
      '2026-09-13T02:00:00.000Z',
      'user-1',
    );
    const newer = createTaskUpsertMutation(
      { ...task, title: 'Newer' },
      '2026-09-13T03:00:00.000Z',
      'user-1',
    );

    await enqueueSyncMutations([older]);
    await enqueueSyncMutations([newer]);
    await removeProcessedSyncMutations([older]);

    expect(await readSyncOutbox('user-1')).toEqual([newer]);
  });
});
