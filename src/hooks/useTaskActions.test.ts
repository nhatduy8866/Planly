import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { PlannerState, Task } from '../types';
import type { TaskFormValues } from '../components/TaskFormModal';
import { TaskTimeConflictError } from '../utils/taskConflicts';
import { useTaskActions } from './useTaskActions';

const mockDispatch = jest.fn();
let mockPlannerState: PlannerState;
const mockReplaceTaskReminders = jest.fn<
  (
    tasks: Task[],
    existingTasks: Task[],
    options?: { language?: 'vi' | 'en' },
  ) => Promise<Task[]>
>();
const mockScheduleTaskReminder = jest.fn<
  (task: Task, language?: 'vi' | 'en') => Promise<string | undefined>
>();

jest.mock('../store/PlannerContext', () => ({
  usePlanner: () => ({ state: mockPlannerState, dispatch: mockDispatch }),
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    language: 'vi',
    t: (key: string) => key,
  }),
}));

jest.mock('../services/reminderTransaction', () => ({
  replaceTaskReminders: (
    tasks: Task[],
    existingTasks: Task[],
    options?: { language?: 'vi' | 'en' },
  ) => mockReplaceTaskReminders(tasks, existingTasks, options),
}));

jest.mock('../services/notifications', () => ({
  cancelTaskReminder: jest.fn(async () => undefined),
  scheduleTaskReminder: (task: Task, language?: 'vi' | 'en') =>
    mockScheduleTaskReminder(task, language),
}));

interface TestRendererInstance {
  unmount(): void;
}

// react-test-renderer is included by jest-expo but does not ship TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Họp nhóm',
    description: '',
    date: '2026-09-09',
    startTime: '09:00',
    reminderMinutes: 15,
    notificationId: 'notification-1',
    batchId: 'batch-1',
    completed: false,
    order: 0,
    priority: 'medium',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function formValues(overrides: Partial<TaskFormValues> = {}): TaskFormValues {
  return {
    title: 'Họp nhóm',
    description: '',
    date: '2026-09-09',
    startTime: '09:00',
    reminderMinutes: 15,
    priority: 'medium',
    ...overrides,
  };
}

describe('useTaskActions batch editing', () => {
  let hook!: ReturnType<typeof useTaskActions>;
  let renderer!: TestRendererInstance;

  function Harness() {
    hook = useTaskActions();
    return null;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPlannerState = {
      hydrated: true,
      notes: [],
      tasks: [
        makeTask(),
        makeTask({
          id: 'task-2',
          date: '2026-09-16',
          notificationId: 'notification-2',
        }),
      ],
    };
    mockReplaceTaskReminders.mockImplementation(async (tasks) => tasks);
    mockScheduleTaskReminder.mockResolvedValue(undefined);

    await act(async () => {
      renderer = create(createElement(Harness));
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('saves a changed occurrence separately and removes its batch link', async () => {
    await act(async () => {
      await hook.saveTask(
        formValues({ title: 'Họp dự án', applyToBatch: false }),
        mockPlannerState.tasks[0],
      );
    });

    expect(mockReplaceTaskReminders).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'task-1', batchId: undefined })],
      mockPlannerState.tasks,
      { language: 'vi' },
    );
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'upsert_task',
      payload: expect.objectContaining({
        id: 'task-1',
        title: 'Họp dự án',
        batchId: undefined,
      }),
    });
  });

  it('saves every occurrence when applying edits to the batch', async () => {
    await act(async () => {
      await hook.saveTask(
        formValues({
          title: 'Họp dự án',
          date: '2026-09-10',
          applyToBatch: true,
        }),
        mockPlannerState.tasks[0],
      );
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'upsert_tasks',
      payload: [
        expect.objectContaining({
          id: 'task-1',
          title: 'Họp dự án',
          date: '2026-09-10',
          batchId: 'batch-1',
        }),
        expect.objectContaining({
          id: 'task-2',
          title: 'Họp dự án',
          date: '2026-09-17',
          batchId: 'batch-1',
        }),
      ],
    });
  });

  it('blocks creating a task at an occupied time before scheduling a reminder', async () => {
    await act(async () => {
      await expect(hook.saveTask(formValues())).rejects.toBeInstanceOf(
        TaskTimeConflictError,
      );
    });

    expect(mockScheduleTaskReminder).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('blocks moving an existing task onto another task time', async () => {
    await act(async () => {
      await expect(
        hook.saveTask(
          formValues({ date: '2026-09-16' }),
          mockPlannerState.tasks[0],
        ),
      ).rejects.toBeInstanceOf(TaskTimeConflictError);
    });

    expect(mockReplaceTaskReminders).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
