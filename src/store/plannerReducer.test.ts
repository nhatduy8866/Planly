import { describe, expect, it } from '@jest/globals';

import type { Task } from '../types';
import { initialPlannerState, plannerReducer } from './plannerReducer';

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Công việc',
    description: '',
    date: '2026-09-05',
    startTime: '09:00',
    durationMinutes: 30,
    reminderMinutes: null,
    completed: false,
    order: 0,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('plannerReducer', () => {
  it('hydrates persisted tasks and notes', () => {
    const result = plannerReducer(initialPlannerState, {
      type: 'hydrate',
      payload: {
        tasks: [task({})],
        notes: [
          {
            id: 'note-1',
            title: 'Ý tưởng',
            content: 'Nội dung',
            createdAt: '2026-09-05T00:00:00.000Z',
            updatedAt: '2026-09-05T00:00:00.000Z',
          },
        ],
      },
    });

    expect(result.hydrated).toBe(true);
    expect(result.tasks).toHaveLength(1);
    expect(result.notes).toHaveLength(1);
  });

  it('sorts a day by start time', () => {
    const state = {
      ...initialPlannerState,
      hydrated: true,
      tasks: [
        task({ id: 'late', startTime: '14:00', order: 0 }),
        task({ id: 'early', startTime: '08:30', order: 1 }),
      ],
    };
    const result = plannerReducer(state, {
      type: 'sort_day',
      payload: { date: '2026-09-05' },
    });

    const orderedIds = [...result.tasks]
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);
    expect(orderedIds).toEqual(['early', 'late']);
  });

  it('sorts a day by task title alphabetically when by is title', () => {
    const state = {
      ...initialPlannerState,
      hydrated: true,
      tasks: [
        task({ id: 'task-b', title: 'Đi mua sắm', order: 0 }),
        task({ id: 'task-a', title: 'Ăn sáng', order: 1 }),
      ],
    };
    const result = plannerReducer(state, {
      type: 'sort_day',
      payload: { date: '2026-09-05', by: 'title' },
    });

    const orderedIds = [...result.tasks]
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);
    expect(orderedIds).toEqual(['task-a', 'task-b']);
  });

  it('sorts a day by task priority from high to low when by is priority', () => {
    const state = {
      ...initialPlannerState,
      hydrated: true,
      tasks: [
        task({ id: 'low-task', priority: 'low', order: 0 }),
        task({ id: 'high-task', priority: 'high', order: 1 }),
        task({ id: 'med-task', priority: 'medium', order: 2 }),
      ],
    };
    const result = plannerReducer(state, {
      type: 'sort_day',
      payload: { date: '2026-09-05', by: 'priority' },
    });

    const orderedIds = [...result.tasks]
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);
    expect(orderedIds).toEqual(['high-task', 'med-task', 'low-task']);
  });

  it('moves a task manually within the selected day', () => {
    const state = {
      ...initialPlannerState,
      hydrated: true,
      tasks: [
        task({ id: 'first', order: 0 }),
        task({ id: 'second', order: 1 }),
      ],
    };
    const result = plannerReducer(state, {
      type: 'move_task',
      payload: { id: 'second', direction: -1 },
    });

    expect(result.tasks.find((item) => item.id === 'second')?.order).toBe(0);
    expect(result.tasks.find((item) => item.id === 'first')?.order).toBe(1);
  });

  it('toggles completion without mutating the other tasks', () => {
    const state = {
      ...initialPlannerState,
      hydrated: true,
      tasks: [task({ id: 'target' }), task({ id: 'other' })],
    };
    const result = plannerReducer(state, {
      type: 'toggle_task',
      payload: { id: 'target' },
    });

    expect(result.tasks.find((item) => item.id === 'target')?.completed).toBe(true);
    expect(result.tasks.find((item) => item.id === 'other')?.completed).toBe(false);
  });

  it('deletes a task by id', () => {
    const state = {
      ...initialPlannerState,
      hydrated: true,
      tasks: [task({ id: 'task-1' }), task({ id: 'task-2' })],
    };
    const result = plannerReducer(state, {
      type: 'delete_task',
      payload: { id: 'task-1' },
    });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe('task-2');
  });

  it('handles move_task safely when initial order values are duplicated', () => {
    const state = {
      ...initialPlannerState,
      hydrated: true,
      tasks: [
        task({ id: 'a', order: 0, createdAt: '2026-09-05T01:00:00.000Z' }),
        task({ id: 'b', order: 0, createdAt: '2026-09-05T02:00:00.000Z' }),
      ],
    };
    const result = plannerReducer(state, {
      type: 'move_task',
      payload: { id: 'b', direction: -1 },
    });

    const b = result.tasks.find((item) => item.id === 'b');
    const a = result.tasks.find((item) => item.id === 'a');
    expect(b?.order).toBe(0);
    expect(a?.order).toBe(1);
  });
});
