import { describe, expect, it } from '@jest/globals';

import type { Task } from '../../types';
import type { AiDraftTask } from '../../types/ai';
import { validateScheduleByDate } from './conflictDetector';
import { autoSlotTasks } from './slottingEngine';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Họp cố định',
    description: '',
    date: '2026-09-08',
    startTime: '09:00',
    reminderMinutes: null,
    completed: false,
    order: 0,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

function makeUnscheduledDraft(
  title: string,
  priority: AiDraftTask['priority'] = 'medium',
): AiDraftTask {
  return {
    id: `draft-${title}`,
    title,
    date: '2026-09-08',
    startTime: '',
    reminderMinutes: 15,
    priority,
    source: 'direct_request',
  };
}

describe('slottingEngine', () => {
  it('assigns distinct start times according to priority', () => {
    const drafts = [
      makeUnscheduledDraft('Làm báo cáo', 'high'),
      makeUnscheduledDraft('Tập gym', 'medium'),
    ];

    const slotted = autoSlotTasks(drafts, [makeTask()], '2026-09-08');

    expect(slotted.map((draft) => draft.startTime)).toEqual(['08:00', '13:30']);
    expect(validateScheduleByDate(slotted, [makeTask()]).isValid).toBe(true);
  });

  it('preserves start times already assigned to drafts', () => {
    const drafts: AiDraftTask[] = [
      {
        ...makeUnscheduledDraft('Đã có giờ', 'none'),
        id: 'd1',
        startTime: '10:00',
      },
      makeUnscheduledDraft('Chưa có giờ', 'low'),
    ];

    const slotted = autoSlotTasks(drafts, [], '2026-09-08');

    expect(slotted[0].startTime).toBe('10:00');
    expect(slotted[1].startTime).toBe('17:00');
  });

  it('leaves a task unscheduled when every supported start time is occupied', () => {
    const existing = Array.from({ length: 55 }, (_, index) => {
      const totalMinutes = 8 * 60 + index * 15;
      const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const minutes = String(totalMinutes % 60).padStart(2, '0');
      return makeTask({ id: `task-${index}`, startTime: `${hours}:${minutes}` });
    });

    const slotted = autoSlotTasks(
      [makeUnscheduledDraft('Việc không còn giờ trống')],
      existing,
      '2026-09-08',
    );

    expect(slotted[0].startTime).toBe('');
    expect(slotted[0].slottingStatus).toBe('unscheduled');
  });

  it('does not reuse a fallback start time when drafts exceed capacity', () => {
    const drafts = Array.from({ length: 57 }, (_, index) =>
      makeUnscheduledDraft(`Việc ${index + 1}`, 'low'),
    );
    const slotted = autoSlotTasks(drafts, [], '2026-09-08');
    const assignedStarts = slotted
      .map((draft) => draft.startTime)
      .filter(Boolean);

    expect(new Set(assignedStarts).size).toBe(55);
    expect(slotted.filter((draft) => !draft.startTime)).toHaveLength(2);
  });

  it.each([
    ['Việc buổi sáng', '08:00'],
    ['Việc buổi trưa', '12:00'],
    ['Việc buổi chiều', '14:30'],
    ['Việc buổi tối', '19:30'],
  ])('uses the requested period for %s', (title, expectedStart) => {
    const slotted = autoSlotTasks(
      [makeUnscheduledDraft(title)],
      [],
      '2026-09-08',
    );

    expect(slotted[0].startTime).toBe(expectedStart);
  });

  it('ignores completed tasks when choosing a start time', () => {
    const slotted = autoSlotTasks(
      [makeUnscheduledDraft('Việc gấp', 'high')],
      [makeTask({ startTime: '08:00', completed: true })],
      '2026-09-08',
    );

    expect(slotted[0].startTime).toBe('08:00');
  });
});
