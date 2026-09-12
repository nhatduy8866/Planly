import { act, createElement } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { PlannerState, Task } from '../types';
import type { AiDraftTask } from '../types/ai';
import type { AiSchedulingProvider } from '../services/ai/aiProvider';
import { AiBatchScheduleError } from '../services/ai/batchIntent';
import { AiScheduleClarificationError } from '../services/ai/scheduleClarification';
import { useAiScheduler } from './useAiScheduler';

const mockDispatch = jest.fn();
let mockPlannerState: PlannerState;
const mockParseScheduleRequest = jest.fn<
  AiSchedulingProvider['parseScheduleRequest']
>();
const mockRefineSchedule = jest.fn<AiSchedulingProvider['refineSchedule']>();
const mockReplaceTaskReminders = jest.fn<
  (
    tasks: Task[],
    existingTasks: Task[],
    options?: {
      alarmPreferences?: { soundUri?: string; vibrate: boolean };
      language?: 'vi' | 'en';
      reminderDeliveryMode?: 'notification' | 'alarm';
    },
  ) => Promise<Task[]>
>();
const mockRollbackTaskReminders = jest.fn<
  (
    savedTasks: Task[],
    previousTasks: Task[],
    options?: {
      alarmPreferences?: { soundUri?: string; vibrate: boolean };
      language?: 'vi' | 'en';
      reminderDeliveryMode?: 'notification' | 'alarm';
    },
  ) => Promise<Task[]>
>();

jest.mock('../store/PlannerContext', () => ({
  usePlannerDispatch: () => mockDispatch,
  usePlannerTasks: () => mockPlannerState.tasks,
}));

jest.mock('../preferences/PreferencesContext', () => {
  const { translate } = jest.requireActual<
    typeof import('../i18n/translations')
  >('../i18n/translations');

  return {
    usePreferences: () => ({
      alarmSound: null,
      alarmVibrationEnabled: true,
      language: 'vi',
      locale: 'vi-VN',
      reminderDeliveryMode: 'notification',
      t: (
        key: Parameters<typeof translate>[1],
        values?: Parameters<typeof translate>[2],
      ) => translate('vi', key, values),
    }),
  };
});

jest.mock('../services/ai/aiProvider', () => ({
  defaultAiProvider: {
    parseScheduleRequest: (...args: Parameters<AiSchedulingProvider['parseScheduleRequest']>) =>
      mockParseScheduleRequest(...args),
    refineSchedule: (...args: Parameters<AiSchedulingProvider['refineSchedule']>) =>
      mockRefineSchedule(...args),
  },
}));

jest.mock('../services/reminderTransaction', () => ({
  replaceTaskReminders: (
    tasks: Task[],
    existingTasks: Task[],
    options?: {
      alarmPreferences?: { soundUri?: string; vibrate: boolean };
      language?: 'vi' | 'en';
      reminderDeliveryMode?: 'notification' | 'alarm';
    },
  ) => mockReplaceTaskReminders(tasks, existingTasks, options),
  rollbackTaskReminders: (
    savedTasks: Task[],
    previousTasks: Task[],
    options?: {
      alarmPreferences?: { soundUri?: string; vibrate: boolean };
      language?: 'vi' | 'en';
      reminderDeliveryMode?: 'notification' | 'alarm';
    },
  ) => mockRollbackTaskReminders(savedTasks, previousTasks, options),
}));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));

interface TestRendererInstance {
  unmount(): void;
  update(element: ReturnType<typeof createElement>): void;
}

// react-test-renderer is included by jest-expo but does not ship TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'existing-task',
    title: 'Lịch hiện có',
    description: '',
    date: '2026-09-08',
    startTime: '09:00',
    reminderMinutes: null,
    completed: false,
    order: 0,
    createdAt: '2026-09-07T00:00:00.000Z',
    updatedAt: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

function makeDraft(overrides: Partial<AiDraftTask> = {}): AiDraftTask {
  return {
    id: 'task-new',
    title: 'Việc AI',
    date: '2026-09-08',
    startTime: '09:00',
    reminderMinutes: 15,
    priority: 'medium',
    source: 'direct_request',
    ...overrides,
  };
}

describe('useAiScheduler', () => {
  let scheduler: ReturnType<typeof useAiScheduler>;
  let renderer: TestRendererInstance;

  function Harness() {
    scheduler = useAiScheduler('2026-09-08');
    return null;
  }

  async function renderScheduler() {
    await act(async () => {
      renderer = create(createElement(Harness));
    });
  }

  function updateTasks(tasks: Task[]) {
    mockPlannerState = { ...mockPlannerState, tasks };
    act(() => renderer.update(createElement(Harness)));
  }

  async function submitPrompt(prompt = 'Lên lịch giúp tôi') {
    await act(async () => {
      const pending = scheduler.submitPrompt(prompt);
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(1500);
      await pending;
    });
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    mockPlannerState = { tasks: [], notes: [], hydrated: true };
    mockDispatch.mockReset();
    mockParseScheduleRequest.mockReset();
    mockRefineSchedule.mockReset();
    mockReplaceTaskReminders.mockReset();
    mockRollbackTaskReminders.mockReset();
    mockReplaceTaskReminders.mockImplementation(async (tasks) => tasks);
    mockRollbackTaskReminders.mockImplementation(
      async (_savedTasks, previousTasks) => previousTasks,
    );
    await renderScheduler();
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('moves to conflict resolution with every detected collision', async () => {
    updateTasks([
      makeTask({ id: 'first', startTime: '09:00' }),
      makeTask({ id: 'second', startTime: '09:00' }),
    ]);
    mockParseScheduleRequest.mockResolvedValue([
      makeDraft({ startTime: '09:00' }),
    ]);

    await submitPrompt();

    expect(scheduler.step).toBe('conflict_resolution');
    expect(scheduler.conflicts).toHaveLength(2);

    act(() => scheduler.handleApplyConflictResolution());

    expect(scheduler.step).toBe('draft_preview');
    expect(scheduler.conflicts).toHaveLength(0);
    expect(scheduler.draftTasks[0].startTime).toBe('09:15');
  });

  it('returns to input with a clarification message for ambiguous time', async () => {
    mockParseScheduleRequest.mockRejectedValue(
      new AiScheduleClarificationError(2),
    );

    await submitPrompt('tao lich 2h toi da bong');

    expect(scheduler.step).toBe('input_prompt');
    expect(scheduler.infoMessage).toContain('2h toi');
    expect(scheduler.draftTasks).toEqual([]);
  });

  it('explains an invalid recurring range instead of creating one task', async () => {
    mockParseScheduleRequest.mockRejectedValue(new AiBatchScheduleError());

    await submitPrompt(
      'tap gym hang tuan tu ngay 07/09/2026 den ngay 08/09/2027',
    );

    expect(scheduler.step).toBe('input_prompt');
    expect(scheduler.infoMessage).toContain('không dài quá 1 năm');
    expect(scheduler.draftTasks).toEqual([]);
  });

  it('updates only the selected AI draft before saving', async () => {
    mockParseScheduleRequest.mockResolvedValue([
      makeDraft({ id: 'first', title: 'Làm báo cáo' }),
      makeDraft({ id: 'second', title: 'Tập thể dục', startTime: '15:00' }),
    ]);
    await submitPrompt();

    act(() => {
      scheduler.updateDraftTask('second', {
        title: 'Tập gym',
        description: 'Tập thân trên',
        date: '2026-09-09',
        startTime: '16:30',
        reminderMinutes: 30,
        priority: 'high',
      });
    });

    expect(scheduler.draftTasks[0]).toMatchObject({
      id: 'first',
      title: 'Làm báo cáo',
      startTime: '09:00',
    });
    expect(scheduler.draftTasks[1]).toMatchObject({
      id: 'second',
      title: 'Tập gym',
      description: 'Tập thân trên',
      date: '2026-09-09',
      startTime: '16:30',
      reminderMinutes: 30,
      priority: 'high',
      changeStatus: 'updated',
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('stays in auto-slotting when a full day cannot fit the draft', async () => {
    updateTasks(
      Array.from({ length: 55 }, (_, index) => {
        const totalMinutes = 8 * 60 + index * 15;
        const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
        const minutes = String(totalMinutes % 60).padStart(2, '0');
        return makeTask({ id: `task-${index}`, startTime: `${hours}:${minutes}` });
      }),
    );
    mockParseScheduleRequest.mockResolvedValue([
      makeDraft({ startTime: '' }),
    ]);

    await submitPrompt();
    expect(scheduler.step).toBe('auto_slotting');

    act(() => scheduler.handleAcceptAutoSlotting());

    expect(scheduler.step).toBe('auto_slotting');
    expect(scheduler.infoMessage).toContain('Không còn đủ giờ bắt đầu trống');
    expect(scheduler.draftTasks[0].startTime).toBe('');
  });

  it('waits for reminder IDs before dispatching the saved batch', async () => {
    mockParseScheduleRequest.mockResolvedValue([makeDraft()]);
    await submitPrompt();

    let finishReminders!: (tasks: Task[]) => void;
    mockReplaceTaskReminders.mockReturnValue(
      new Promise((resolve) => {
        finishReminders = resolve;
      }),
    );

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = scheduler.confirmSaveToCalendar();
    });
    expect(mockDispatch).not.toHaveBeenCalled();

    const taskWithReminder = makeTask({
      id: 'task-new',
      title: 'Việc AI',
      notificationId: 'notification-new',
    });
    await act(async () => {
      finishReminders([taskWithReminder]);
      await savePromise;
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'create_batch_tasks',
      payload: [taskWithReminder],
    });
    expect(mockReplaceTaskReminders).toHaveBeenCalledWith(
      expect.any(Array),
      mockPlannerState.tasks,
      {
        alarmPreferences: { soundUri: undefined, vibrate: true },
        language: 'vi',
        reminderDeliveryMode: 'notification',
      },
    );
    expect(scheduler.visible).toBe(false);
    expect(scheduler.saveFeedback).toMatchObject({
      createdCount: 1,
      updatedCount: 0,
    });
    expect(scheduler.highlightedTaskIds.has('task-new')).toBe(true);
  });

  it('persists AI recurrence occurrences with one shared batch ID', async () => {
    mockParseScheduleRequest.mockResolvedValue([
      makeDraft({
        id: 'monday',
        date: '2026-09-07',
        batchGroupId: 'ai-batch-gym',
      }),
      makeDraft({
        id: 'wednesday',
        date: '2026-09-09',
        batchGroupId: 'ai-batch-gym',
      }),
    ]);
    await submitPrompt();

    await act(async () => {
      await scheduler.confirmSaveToCalendar();
    });

    const tasksToSave = mockReplaceTaskReminders.mock.calls[0][0];
    expect(tasksToSave.map((task) => task.date)).toEqual([
      '2026-09-07',
      '2026-09-09',
    ]);
    expect(tasksToSave[0].batchId).toBeTruthy();
    expect(tasksToSave[1].batchId).toBe(tasksToSave[0].batchId);
    expect(new Set(tasksToSave.map((task) => task.id)).size).toBe(2);
  });

  it('detects a conflict on any occurrence inside an AI batch', async () => {
    updateTasks([
      makeTask({ date: '2026-09-14', startTime: '09:00' }),
    ]);
    mockParseScheduleRequest.mockResolvedValue([
      makeDraft({
        id: 'first-occurrence',
        date: '2026-09-07',
        batchGroupId: 'ai-batch-gym',
      }),
      makeDraft({
        id: 'conflicting-occurrence',
        date: '2026-09-14',
        batchGroupId: 'ai-batch-gym',
      }),
    ]);

    await submitPrompt();

    expect(scheduler.step).toBe('conflict_resolution');
    expect(scheduler.conflicts).toHaveLength(1);
    expect(scheduler.conflicts[0].draftTaskId).toBe('conflicting-occurrence');
  });

  it('undoes an AI update with its previous task and reminder', async () => {
    const previous = makeTask({ notificationId: 'notification-old' });
    updateTasks([previous]);
    mockParseScheduleRequest.mockResolvedValue([
      makeDraft({ id: previous.id, startTime: '14:00' }),
    ]);
    await submitPrompt();
    await act(async () => {
      await scheduler.confirmSaveToCalendar();
    });

    const restored = { ...previous, notificationId: 'notification-restored' };
    mockRollbackTaskReminders.mockResolvedValue([restored]);
    await act(async () => {
      await scheduler.undoLastSave();
    });

    expect(mockRollbackTaskReminders).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: previous.id })]),
      [previous],
      {
        alarmPreferences: { soundUri: undefined, vibrate: true },
        language: 'vi',
        reminderDeliveryMode: 'notification',
      },
    );
    expect(mockDispatch).toHaveBeenLastCalledWith({
      type: 'rollback_task_batch',
      payload: { savedIds: [previous.id], previousTasks: [restored] },
    });
    expect(scheduler.saveFeedback).toBeNull();
  });

  it('rechecks conflicts introduced by refinement before previewing', async () => {
    updateTasks([makeTask({ startTime: '09:00' })]);
    mockParseScheduleRequest.mockResolvedValue([
      makeDraft({ startTime: '11:00' }),
    ]);
    await submitPrompt();
    expect(scheduler.step).toBe('draft_preview');

    mockRefineSchedule.mockResolvedValue([
      makeDraft({ startTime: '09:00' }),
    ]);
    await act(async () => {
      const pending = scheduler.submitRefinement('Dời việc AI sang 9h30');
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(1200);
      await pending;
    });

    expect(scheduler.step).toBe('conflict_resolution');
    expect(scheduler.conflicts).toHaveLength(1);
    expect(scheduler.conflicts[0].conflictingTask.id).toBe('existing-task');
  });
});
