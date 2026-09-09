import { describe, expect, it } from '@jest/globals';

import type { Task } from '../../types';
import type { AiDraftTask } from '../../types/ai';
import { detectConflicts, validateScheduleByDate } from './conflictDetector';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Họp phòng',
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

function makeDraft(overrides: Partial<AiDraftTask> = {}): AiDraftTask {
  return {
    id: 'draft-1',
    title: 'Làm báo cáo',
    date: '2026-09-08',
    startTime: '09:00',
    reminderMinutes: 15,
    priority: 'medium',
    source: 'direct_request',
    ...overrides,
  };
}

describe('conflictDetector', () => {
  it('allows tasks with different start times', () => {
    expect(
      detectConflicts([makeDraft({ startTime: '09:15' })], [makeTask()]),
    ).toHaveLength(0);
  });

  it('detects tasks with the same start time on the same day', () => {
    const conflicts = detectConflicts(
      [makeDraft({ title: 'Làm báo cáo' })],
      [makeTask({ title: 'Họp phòng' })],
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].draftTaskTitle).toBe('Làm báo cáo');
    expect(conflicts[0].draftTime).toBe('09:00');
    expect(conflicts[0].conflictingTask.title).toBe('Họp phòng');
    expect(conflicts[0].conflictingTask.origin).toBe('existing');
    expect(conflicts[0].suggestedSlots[0].startTime).toBe('09:15');
    expect(conflicts[0].suggestedSlots[0].label).toContain('Họp phòng');
  });

  it('ignores completed tasks and tasks on different dates', () => {
    const existing = [
      makeTask({ id: 'done', completed: true }),
      makeTask({ id: 'other-day', date: '2026-09-09' }),
    ];

    expect(detectConflicts([makeDraft()], existing)).toHaveLength(0);
  });

  it('detects duplicate start times between drafts on the same day', () => {
    const drafts = [
      makeDraft({ id: 'draft-a' }),
      makeDraft({ id: 'draft-b' }),
    ];
    const validation = validateScheduleByDate(drafts, []);
    const conflicts = detectConflicts(drafts, []);

    expect(validation.isValid).toBe(false);
    expect(validation.collisions).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].draftTaskId).toBe('draft-b');
    expect(conflicts[0].conflictingTask.id).toBe('draft-a');
    expect(conflicts[0].conflictingTask.origin).toBe('draft');
  });

  it('allows drafts with different start times or dates', () => {
    const drafts = [
      makeDraft({ id: 'draft-a' }),
      makeDraft({ id: 'draft-b', startTime: '09:15' }),
      makeDraft({ id: 'draft-c', date: '2026-09-09' }),
    ];

    expect(validateScheduleByDate(drafts, []).isValid).toBe(true);
  });

  it('does not compare a draft with the stored version of the same task', () => {
    expect(
      validateScheduleByDate(
        [makeDraft({ id: 'task-1' })],
        [makeTask({ id: 'task-1' })],
      ).isValid,
    ).toBe(true);
  });

  it('skips occupied start times when creating suggestions', () => {
    const existing = [
      makeTask({ id: 'meeting', startTime: '09:00' }),
      makeTask({ id: 'next-meeting', startTime: '09:15' }),
    ];
    const conflicts = detectConflicts([makeDraft()], existing);

    expect(conflicts[0].suggestedSlots[0].startTime).toBe('09:30');
    expect(
      conflicts[0].suggestedSlots.some((slot) => slot.startTime === '09:15'),
    ).toBe(false);
  });

  it('keeps suggestions clear of other drafts in the plan', () => {
    const drafts = [
      makeDraft({ id: 'draft-target' }),
      makeDraft({ id: 'draft-blocker', startTime: '09:15' }),
    ];
    const targetConflict = detectConflicts(
      drafts,
      [makeTask({ id: 'meeting' })],
    ).find((conflict) => conflict.draftTaskId === 'draft-target');

    expect(targetConflict?.suggestedSlots[0].startTime).toBe('09:30');
  });

  it('returns no suggestion when every supported start time is occupied', () => {
    const existing = Array.from({ length: 55 }, (_, index) => {
      const totalMinutes = 8 * 60 + index * 15;
      const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
      const minutes = String(totalMinutes % 60).padStart(2, '0');
      return makeTask({ id: `task-${index}`, startTime: `${hours}:${minutes}` });
    });

    const conflicts = detectConflicts([makeDraft()], existing);

    expect(conflicts[0].suggestedSlots).toHaveLength(0);
    expect(conflicts[0].selectedSlotId).toBe('');
  });

  it('reports every task that has the same start time as one draft', () => {
    const existing = [
      makeTask({ id: 'first' }),
      makeTask({ id: 'second' }),
    ];
    const conflicts = detectConflicts([makeDraft({ id: 'target' })], existing);

    expect(conflicts.map((conflict) => conflict.conflictingTask.id)).toEqual([
      'first',
      'second',
    ]);
  });
});
