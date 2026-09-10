import { describe, expect, it, jest } from '@jest/globals';

import type { Task } from '../types';
import {
  replaceTaskReminders,
  rollbackTaskReminders,
} from './reminderTransaction';

jest.mock('./notifications', () => ({
  cancelTaskReminder: jest.fn(),
  scheduleTaskReminder: jest.fn(),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Họp nhóm',
    description: '',
    date: '2026-09-08',
    startTime: '09:00',
    reminderMinutes: 15,
    completed: false,
    order: 0,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('replaceTaskReminders', () => {
  it('cancels each old reminder before scheduling and storing its replacement', async () => {
    const events: string[] = [];
    const existingTasks = [
      makeTask({ id: 'task-1', notificationId: 'old-1' }),
    ];
    const tasks = [
      makeTask({ id: 'task-1', notificationId: 'old-1' }),
      makeTask({ id: 'task-2', notificationId: undefined }),
    ];
    const cancelReminder = jest.fn(async (notificationId?: string) => {
      events.push(`cancel:${notificationId ?? 'none'}`);
    });
    const scheduleReminder = jest.fn(async (task: Task) => {
      events.push(`schedule:${task.id}`);
      expect(task.notificationId).toBeUndefined();
      return `new-${task.id}`;
    });

    const result = await replaceTaskReminders(tasks, existingTasks, {
      language: 'en',
      dependencies: {
        cancelReminder,
        scheduleReminder,
      },
    });

    expect(events).toEqual(expect.arrayContaining([
      'cancel:old-1',
      'schedule:task-1',
      'cancel:none',
      'schedule:task-2',
    ]));
    expect(events.indexOf('cancel:old-1')).toBeLessThan(
      events.indexOf('schedule:task-1'),
    );
    expect(events.indexOf('cancel:none')).toBeLessThan(
      events.indexOf('schedule:task-2'),
    );
    expect(result.map((task) => task.notificationId)).toEqual([
      'new-task-1',
      'new-task-2',
    ]);
    expect(scheduleReminder).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'task-1' }),
      'en',
      'notification',
    );
  });

  it('passes the selected alarm mode to each replacement', async () => {
    const scheduleReminder = jest.fn(async () => 'alarm:new-1');

    await replaceTaskReminders([makeTask()], [], {
      dependencies: {
        cancelReminder: jest.fn(async () => undefined),
        scheduleReminder,
      },
      reminderDeliveryMode: 'alarm',
    });

    expect(scheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' }),
      'vi',
      'alarm',
    );
  });

  it('clears the stale ID and continues when scheduling a reminder fails', async () => {
    const firstTask = makeTask({ notificationId: 'old-1' });
    const secondTask = makeTask({ id: 'task-2', notificationId: 'old-2' });
    const cancelReminder = jest.fn(async () => undefined);
    const scheduleReminder = jest
      .fn<(task: Task) => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error('schedule failed'))
      .mockResolvedValueOnce('new-2');

    const result = await replaceTaskReminders(
      [firstTask, secondTask],
      [firstTask, secondTask],
      { dependencies: { cancelReminder, scheduleReminder } },
    );

    expect(cancelReminder).toHaveBeenNthCalledWith(1, 'old-1');
    expect(cancelReminder).toHaveBeenNthCalledWith(2, 'old-2');
    expect(result[0].notificationId).toBeUndefined();
    expect(result[1].notificationId).toBe('new-2');
  });
});

describe('rollbackTaskReminders', () => {
  it('cancels new task reminders and restores reminders for updated tasks', async () => {
    const savedTasks = [
      makeTask({ id: 'updated', notificationId: 'new-updated' }),
      makeTask({ id: 'created', notificationId: 'new-created' }),
    ];
    const previousTasks = [
      makeTask({ id: 'updated', notificationId: 'old-updated' }),
    ];
    const cancelReminder = jest.fn(async () => undefined);
    const scheduleReminder = jest.fn(async () => 'restored-updated');

    const restored = await rollbackTaskReminders(savedTasks, previousTasks, {
      dependencies: { cancelReminder, scheduleReminder },
    });

    expect(cancelReminder).toHaveBeenCalledWith('new-created');
    expect(cancelReminder).toHaveBeenCalledWith('new-updated');
    expect(scheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'updated', notificationId: undefined }),
      'vi',
      'notification',
    );
    expect(restored).toEqual([
      expect.objectContaining({
        id: 'updated',
        notificationId: 'restored-updated',
      }),
    ]);
  });
});
