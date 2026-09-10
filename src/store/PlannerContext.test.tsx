import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppState } from 'react-native';

import type { Note, Task } from '../types';
import {
  PlannerProvider,
  usePlannerDispatch,
  usePlannerHydrated,
  usePlannerNotes,
  usePlannerTasks,
} from './PlannerContext';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

interface TestRendererInstance {
  unmount(): void;
}

// react-test-renderer is included by jest-expo but does not ship TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

const task: Task = {
  id: 'task-1',
  title: 'Họp nhóm',
  description: '',
  date: '2026-09-10',
  startTime: '09:00',
  reminderMinutes: null,
  completed: false,
  order: 0,
  priority: 'medium',
  createdAt: '2026-09-09T00:00:00.000Z',
  updatedAt: '2026-09-09T00:00:00.000Z',
};

const note: Note = {
  id: 'note-1',
  title: 'Ghi chú',
  content: '',
  createdAt: '2026-09-09T00:00:00.000Z',
  updatedAt: '2026-09-09T00:00:00.000Z',
};

describe('PlannerProvider persistence', () => {
  let renderer!: TestRendererInstance;
  let planner!: {
    dispatch: ReturnType<typeof usePlannerDispatch>;
    hydrated: boolean;
    notes: Note[];
    tasks: Task[];
  };

  function Harness() {
    planner = {
      dispatch: usePlannerDispatch(),
      hydrated: usePlannerHydrated(),
      notes: usePlannerNotes(),
      tasks: usePlannerTasks(),
    };
    return null;
  }

  async function renderProvider() {
    await act(async () => {
      renderer = create(
        createElement(PlannerProvider, null, createElement(Harness)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('migrates the legacy combined state and persists each collection separately', async () => {
    mockGetItem.mockImplementation(async (key) =>
      key === '@planly/planner/v1'
        ? JSON.stringify({ tasks: [task], notes: [note] })
        : null,
    );

    await renderProvider();

    expect(planner.hydrated).toBe(true);
    expect(planner.tasks).toEqual([task]);
    expect(planner.notes).toEqual([note]);
    expect(mockSetItem).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      '@planly/tasks/v1',
      JSON.stringify([task]),
    );
    expect(mockSetItem).toHaveBeenCalledWith(
      '@planly/notes/v1',
      JSON.stringify([note]),
    );
  });

  it('coalesces rapid note changes without rewriting tasks', async () => {
    mockGetItem.mockImplementation(async (key) => {
      if (key === '@planly/tasks/v1') return JSON.stringify([task]);
      if (key === '@planly/notes/v1') return JSON.stringify([]);
      return null;
    });

    await renderProvider();
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    mockSetItem.mockClear();

    act(() => {
      planner.dispatch({ type: 'upsert_note', payload: note });
      planner.dispatch({
        type: 'upsert_note',
        payload: { ...note, title: 'Ghi chú mới' },
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(299);
      await Promise.resolve();
    });
    expect(mockSetItem).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      '@planly/notes/v1',
      JSON.stringify([{ ...note, title: 'Ghi chú mới' }]),
    );
  });
});
