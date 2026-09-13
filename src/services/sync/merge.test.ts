import { describe, expect, it } from '@jest/globals';

import type { Note, Task } from '../../types';
import { diffPlannerData, mergePlannerSnapshots } from './merge';
import {
  createDeleteMutation,
  taskForSync,
  type CloudPlannerSnapshot,
} from './types';

const task: Task = {
  completed: false,
  createdAt: '2026-09-13T01:00:00.000Z',
  date: '2026-09-14',
  description: '',
  id: 'task-1',
  notificationId: 'device-notification-1',
  order: 0,
  priority: 'medium',
  reminderMinutes: 15,
  startTime: '09:00',
  title: 'Họp nhóm',
  updatedAt: '2026-09-13T01:00:00.000Z',
};

const note: Note = {
  content: 'Nội dung',
  createdAt: '2026-09-13T01:00:00.000Z',
  id: 'note-1',
  title: 'Ghi chú',
  updatedAt: '2026-09-13T01:00:00.000Z',
};

const emptyCloud: CloudPlannerSnapshot = { notes: [], tasks: [] };

describe('mergePlannerSnapshots', () => {
  it('uploads existing local data on the first account sync without notification ids', () => {
    const result = mergePlannerSnapshots([task], [note], emptyCloud, []);

    expect(result.tasks).toEqual([task]);
    expect(result.notes).toEqual([note]);
    expect(result.mutationsToPush).toHaveLength(2);
    const taskMutation = result.mutationsToPush.find(
      (mutation) => mutation.entity === 'task',
    );
    expect(taskMutation?.operation).toBe('upsert');
    if (taskMutation?.operation === 'upsert') {
      expect(taskMutation.record).not.toHaveProperty('notificationId');
    }
  });

  it('downloads remote data on a new device', () => {
    const remoteTask = {
      ...taskForSync(task),
      title: 'Task từ cloud',
      updatedAt: '2026-09-13T02:00:00.000Z',
    };
    const result = mergePlannerSnapshots(
      [],
      [],
      {
        notes: [],
        tasks: [
          {
            changedAt: remoteTask.updatedAt,
            deletedAt: null,
            id: remoteTask.id,
            record: remoteTask,
          },
        ],
      },
      [],
    );

    expect(result.tasks).toEqual([
      { ...remoteTask, notificationId: undefined },
    ]);
    expect(result.mutationsToPush).toEqual([]);
  });

  it('keeps the device notification id when a newer cloud task wins', () => {
    const remoteTask = {
      ...taskForSync(task),
      title: 'Tên mới từ máy khác',
      updatedAt: '2026-09-13T03:00:00.000Z',
    };
    const result = mergePlannerSnapshots(
      [task],
      [],
      {
        notes: [],
        tasks: [
          {
            changedAt: remoteTask.updatedAt,
            deletedAt: null,
            id: remoteTask.id,
            record: remoteTask,
          },
        ],
      },
      [],
    );

    expect(result.tasks[0]).toEqual({
      ...remoteTask,
      notificationId: task.notificationId,
    });
  });

  it('applies a newer remote deletion instead of reviving stale local data', () => {
    const result = mergePlannerSnapshots(
      [task],
      [],
      {
        notes: [],
        tasks: [
          {
            changedAt: '2026-09-13T04:00:00.000Z',
            deletedAt: '2026-09-13T04:00:00.000Z',
            id: task.id,
            record: null,
          },
        ],
      },
      [],
    );

    expect(result.tasks).toEqual([]);
    expect(result.mutationsToPush).toEqual([]);
  });

  it('pushes an offline deletion when it is newer than the cloud row', () => {
    const deletion = createDeleteMutation(
      'task',
      task.id,
      '2026-09-13T05:00:00.000Z',
    );
    const result = mergePlannerSnapshots(
      [],
      [],
      {
        notes: [],
        tasks: [
          {
            changedAt: task.updatedAt,
            deletedAt: null,
            id: task.id,
            record: taskForSync(task),
          },
        ],
      },
      [deletion],
    );

    expect(result.tasks).toEqual([]);
    expect(result.mutationsToPush).toEqual([deletion]);
    expect(result.consumedMutations).toEqual([deletion]);
  });
});

describe('diffPlannerData', () => {
  it('does not sync notification ids because they belong to one device', () => {
    const mutations = diffPlannerData(
      [task],
      [note],
      [{ ...task, notificationId: 'another-device-id' }],
      [note],
    );

    expect(mutations).toEqual([]);
  });

  it('creates a timestamped mutation for a changed task', () => {
    const changedAt = '2026-09-13T06:00:00.000Z';
    const updated = { ...task, title: 'Tên mới' };
    const mutations = diffPlannerData([task], [], [updated], [], changedAt);

    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toEqual(
      expect.objectContaining({
        changedAt,
        entity: 'task',
        id: task.id,
        operation: 'upsert',
      }),
    );
    if (mutations[0].operation === 'upsert') {
      expect(mutations[0].record).toEqual({
        ...taskForSync(updated),
        updatedAt: changedAt,
      });
    }
  });
});
