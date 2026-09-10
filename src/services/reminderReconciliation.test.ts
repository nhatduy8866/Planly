import { describe, expect, it, jest } from '@jest/globals';
import type * as Notifications from 'expo-notifications';

import type { Task } from '../types';
import { getTaskReminderKey, TASK_REMINDER_SOURCE } from './notifications';
import {
  reconcileTaskReminders,
  type ReminderReconciliationDependencies,
} from './reminderReconciliation';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

function task(overrides: Partial<Task> = {}): Task {
  return {
    completed: false,
    createdAt: '2099-01-01T00:00:00.000Z',
    date: '2099-01-02',
    description: '',
    id: 'task-1',
    order: 0,
    reminderMinutes: 15,
    startTime: '14:00',
    title: 'Đá bóng',
    updatedAt: '2099-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function request(
  target: Task,
  identifier: string,
  options: {
    key?: string;
    legacy?: boolean;
    source?: string;
  } = {},
): Notifications.NotificationRequest {
  const data: Record<string, unknown> = { taskId: target.id };
  if (!options.legacy) {
    data.source = options.source ?? TASK_REMINDER_SOURCE;
    data.reminderKey = options.key ?? getTaskReminderKey(target, 'vi');
  }
  return {
    content: { data },
    identifier,
    trigger: null,
  } as unknown as Notifications.NotificationRequest;
}

function dependencies(
  scheduled: Notifications.NotificationRequest[],
  permissionState: 'denied' | 'granted' = 'granted',
): ReminderReconciliationDependencies & {
  cancelReminder: jest.Mock<(notificationId?: string) => Promise<void>>;
  scheduleReminder: jest.Mock<(target: Task) => Promise<string | undefined>>;
} {
  let nextId = 1;
  const cancelReminder = jest.fn(async (notificationId?: string) => {
    const index = scheduled.findIndex(
      (item) => item.identifier === notificationId,
    );
    if (index >= 0) scheduled.splice(index, 1);
  });
  const scheduleReminder = jest.fn(async (target: Task) => {
    const identifier = `new-${nextId++}`;
    scheduled.push(request(target, identifier));
    return identifier;
  });
  return {
    cancelReminder,
    getPermission: async () => ({
      canAskAgain: permissionState !== 'denied',
      state: permissionState,
    }),
    getScheduledReminders: async () => [...scheduled],
    now: () => new Date(2099, 0, 1, 0, 0, 0).getTime(),
    scheduleReminder,
  };
}

function applyUpdates(
  tasks: Task[],
  updates: { id: string; notificationId: string | undefined }[],
): Task[] {
  const byId = new Map(updates.map((update) => [update.id, update.notificationId]));
  return tasks.map((item) =>
    byId.has(item.id)
      ? { ...item, notificationId: byId.get(item.id) }
      : item,
  );
}

describe('reconcileTaskReminders', () => {
  it('keeps a matching scheduled reminder unchanged', async () => {
    const target = task({ notificationId: 'current-1' });
    const scheduled = [request(target, 'current-1')];
    const deps = dependencies(scheduled);

    const result = await reconcileTaskReminders([target], 'vi', deps);

    expect(result).toEqual({
      canceled: 0,
      errors: 0,
      notificationIdUpdates: [],
      scheduled: 0,
    });
    expect(deps.scheduleReminder).not.toHaveBeenCalled();
  });

  it('schedules a missing reminder and is idempotent on the next run', async () => {
    let tasks = [task()];
    const scheduled: Notifications.NotificationRequest[] = [];
    const deps = dependencies(scheduled);

    const first = await reconcileTaskReminders(tasks, 'vi', deps);
    tasks = applyUpdates(tasks, first.notificationIdUpdates);
    const second = await reconcileTaskReminders(tasks, 'vi', deps);

    expect(first.notificationIdUpdates).toEqual([
      { id: 'task-1', notificationId: 'new-1' },
    ]);
    expect(first.scheduled).toBe(1);
    expect(second.notificationIdUpdates).toEqual([]);
    expect(second.scheduled).toBe(0);
    expect(deps.scheduleReminder).toHaveBeenCalledTimes(1);
  });

  it('cancels orphan reminders but ignores notifications owned by another feature', async () => {
    const orphan = task({ id: 'deleted-task' });
    const foreign = task({ id: 'foreign-task' });
    const scheduled = [
      request(orphan, 'orphan-1', { legacy: true }),
      request(foreign, 'foreign-1', { source: 'another-feature' }),
    ];
    const deps = dependencies(scheduled);

    const result = await reconcileTaskReminders([], 'vi', deps);

    expect(deps.cancelReminder).toHaveBeenCalledTimes(1);
    expect(deps.cancelReminder).toHaveBeenCalledWith('orphan-1');
    expect(result.canceled).toBe(1);
    expect(scheduled.map((item) => item.identifier)).toEqual(['foreign-1']);
  });

  it('keeps the stored matching reminder and removes duplicate or stale entries', async () => {
    const target = task({ notificationId: 'current-2' });
    const scheduled = [
      request(target, 'current-1'),
      request(target, 'current-2'),
      request(target, 'stale-1', { key: 'old-task-data' }),
      request(target, 'legacy-1', { legacy: true }),
    ];
    const deps = dependencies(scheduled);

    const result = await reconcileTaskReminders([target], 'vi', deps);

    expect(result.canceled).toBe(3);
    expect(result.notificationIdUpdates).toEqual([]);
    expect(scheduled.map((item) => item.identifier)).toEqual(['current-2']);
  });

  it('cancels reminders and clears IDs for completed, past, or disabled tasks', async () => {
    const completed = task({ completed: true, id: 'completed', notificationId: 'n-1' });
    const past = task({
      date: '2020-01-01',
      id: 'past',
      notificationId: 'n-2',
    });
    const disabled = task({
      id: 'disabled',
      notificationId: 'n-3',
      reminderMinutes: null,
    });
    const scheduled = [
      request(completed, 'n-1'),
      request(past, 'n-2'),
      request(disabled, 'n-3'),
    ];
    const deps = dependencies(scheduled);

    const result = await reconcileTaskReminders(
      [completed, past, disabled],
      'vi',
      deps,
    );

    expect(result.canceled).toBe(3);
    expect(result.notificationIdUpdates).toEqual([
      { id: 'completed', notificationId: undefined },
      { id: 'past', notificationId: undefined },
      { id: 'disabled', notificationId: undefined },
    ]);
    expect(deps.scheduleReminder).not.toHaveBeenCalled();
  });

  it('does not request a new schedule when notification permission is denied', async () => {
    const target = task({ notificationId: 'missing-native-id' });
    const deps = dependencies([], 'denied');

    const result = await reconcileTaskReminders([target], 'vi', deps);

    expect(deps.scheduleReminder).not.toHaveBeenCalled();
    expect(result.notificationIdUpdates).toEqual([
      { id: 'task-1', notificationId: undefined },
    ]);
  });

  it('replaces an outdated reminder when task details or language change', async () => {
    const target = task({ notificationId: 'old-1' });
    const scheduled = [request(target, 'old-1', { key: 'old-key' })];
    const deps = dependencies(scheduled);

    const result = await reconcileTaskReminders([target], 'en', deps);

    expect(deps.cancelReminder).toHaveBeenCalledWith('old-1');
    expect(deps.scheduleReminder).toHaveBeenCalledWith(target, 'en');
    expect(result.notificationIdUpdates).toEqual([
      { id: 'task-1', notificationId: 'new-1' },
    ]);
  });
});
