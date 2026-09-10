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
    options?: { language?: 'vi' | 'en' },
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
      language: 'vi',
      locale: 'vi-VN',
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
    options?: { language?: 'vi' | 'en' },
  ) => mockReplaceTaskReminders(tasks, existingTasks, options),
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
    mockReplaceTaskReminders.mockImplementation(async (tasks) => tasks);
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
      { language: 'vi' },
    );
    expect(scheduler.step).toBe('success');
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
