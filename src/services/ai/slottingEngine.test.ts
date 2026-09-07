import { describe, expect, it } from '@jest/globals';

import type { Task } from '../../types';
import type { AiDraftTask } from '../../types/ai';
import { autoSlotTasks } from './slottingEngine';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Họp cố định',
    description: '',
    date: '2026-09-08',
    startTime: '09:00',
    durationMinutes: 60,
    reminderMinutes: null,
    completed: false,
    order: 0,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function makeUnscheduledDraft(title: string, durationMinutes: number, priority: AiDraftTask['priority'] = 'medium'): AiDraftTask {
  return {
    id: `draft-${title}`,
    title,
    date: '2026-09-08',
    startTime: '',
    durationMinutes,
    reminderMinutes: 15,
    priority,
    source: 'direct_request',
  };
}

describe('slottingEngine', () => {
  it('automatically slots unscheduled tasks into available morning and afternoon gaps', () => {
    const existing = [
      makeTask({ startTime: '09:00', durationMinutes: 60 }), // 09:00 - 10:00
    ];
    const drafts = [
      makeUnscheduledDraft('Làm báo cáo', 60, 'high'),
      makeUnscheduledDraft('Tập gym', 60, 'medium'),
    ];

    const slotted = autoSlotTasks(drafts, existing, '2026-09-08');

    expect(slotted).toHaveLength(2);
    expect(slotted[0].startTime).toBeTruthy();
    expect(slotted[1].startTime).toBeTruthy();

    // High priority gets early morning (08:00) before 09:00 meeting
    expect(slotted[0].startTime).toBe('08:00');
    // Gym gets afternoon
    expect(slotted[1].startTime).toBe('13:30');
  });

  it('preserves existing start times if already present', () => {
    const existing: Task[] = [];
    const drafts: AiDraftTask[] = [
      {
        id: 'd1',
        title: 'Đã có giờ',
        date: '2026-09-08',
        startTime: '10:00',
        durationMinutes: 45,
        reminderMinutes: null,
        priority: 'none',
        source: 'direct_request',
      },
      makeUnscheduledDraft('Chưa có giờ', 30, 'low'),
    ];

    const slotted = autoSlotTasks(drafts, existing, '2026-09-08');
    expect(slotted[0].startTime).toBe('10:00');
    expect(slotted[1].startTime).toBeTruthy();
  });

  it('keeps a task unscheduled when the day has no available slot', () => {
    const existing = [
      makeTask({ startTime: '08:00', durationMinutes: 13 * 60 + 30 }),
    ];
    const drafts = [makeUnscheduledDraft('Việc không còn chỗ', 60)];

    const slotted = autoSlotTasks(drafts, existing, '2026-09-08');

    expect(slotted[0].startTime).toBe('');
    expect(slotted[0].slottingStatus).toBe('unscheduled');
  });

  it('does not stack overflow tasks at a fallback time', () => {
    const drafts = Array.from({ length: 15 }, (_, index) =>
      makeUnscheduledDraft(`Việc ${index + 1}`, 60, 'low'),
    );

    const slotted = autoSlotTasks(drafts, [], '2026-09-08');
    const unscheduled = slotted.filter(
      (draft) => draft.slottingStatus === 'unscheduled',
    );

    expect(unscheduled).toHaveLength(2);
    expect(unscheduled.every((draft) => draft.startTime === '')).toBe(true);
    expect(slotted.filter((draft) => draft.startTime === '20:00')).toHaveLength(1);
  });

  it('leaves every new task unscheduled when adjacent tasks fill the whole day', () => {
    const existing = [
      makeTask({ id: 'morning', startTime: '08:00', durationMinutes: 240 }),
      makeTask({ id: 'afternoon', startTime: '12:00', durationMinutes: 270 }),
      makeTask({ id: 'evening', startTime: '16:30', durationMinutes: 300 }),
    ];
    const drafts = [
      makeUnscheduledDraft('Việc gấp', 15, 'high'),
      makeUnscheduledDraft('Việc thường', 30, 'medium'),
    ];

    const slotted = autoSlotTasks(drafts, existing, '2026-09-08');

    expect(slotted).toHaveLength(2);
    expect(
      slotted.every(
        (draft) =>
          draft.startTime === '' && draft.slottingStatus === 'unscheduled',
      ),
    ).toBe(true);
  });
});
