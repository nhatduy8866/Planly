import { describe, expect, it } from '@jest/globals';

import type { Task } from '../../types';
import type { AiDraftTask } from '../../types/ai';
import { detectConflicts, validateScheduleByDate } from './conflictDetector';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Họp phòng',
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

function makeDraft(overrides: Partial<AiDraftTask>): AiDraftTask {
  return {
    id: 'draft-1',
    title: 'Làm báo cáo',
    date: '2026-09-08',
    startTime: '09:00',
    durationMinutes: 120,
    reminderMinutes: 15,
    priority: 'medium',
    source: 'direct_request',
    ...overrides,
  };
}

describe('conflictDetector', () => {
  it('detects no conflicts when times do not overlap', () => {
    const existing = [makeTask({ startTime: '09:00', durationMinutes: 60 })];
    const drafts = [makeDraft({ startTime: '10:30', durationMinutes: 60 })];

    const conflicts = detectConflicts(drafts, existing);
    expect(conflicts).toHaveLength(0);
  });

  it('detects conflict when draft overlaps existing task on same day', () => {
    const existing = [makeTask({ title: 'Họp phòng', startTime: '09:00', durationMinutes: 60 })];
    // Draft: 09:00 -> 11:00 (overlaps with existing 09:00 -> 10:00)
    const drafts = [makeDraft({ title: 'Làm báo cáo', startTime: '09:00', durationMinutes: 120 })];

    const conflicts = detectConflicts(drafts, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].draftTaskTitle).toBe('Làm báo cáo');
    expect(conflicts[0].conflictingTask.title).toBe('Họp phòng');
    expect(conflicts[0].conflictingTask.origin).toBe('existing');
    expect(conflicts[0].draftRange.startTime).toBe('09:00');
    expect(conflicts[0].draftRange.endTime).toBe('11:00');

    // Verify suggested slots
    const suggestions = conflicts[0].suggestedSlots;
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    // Slot 1: after conflict (10:00 + 15m = 10:15 -> 12:15)
    expect(suggestions[0].startTime).toBe('10:15');
    expect(suggestions[0].endTime).toBe('12:15');
    expect(suggestions[0].label).toContain('Họp phòng');
  });

  it('ignores completed tasks and tasks on different dates', () => {
    const existing = [
      makeTask({ id: 'done', startTime: '09:00', durationMinutes: 60, completed: true }),
      makeTask({ id: 'other-day', date: '2026-09-09', startTime: '09:00', durationMinutes: 60 }),
    ];
    const drafts = [makeDraft({ startTime: '09:00', durationMinutes: 120 })];

    const conflicts = detectConflicts(drafts, existing);
    expect(conflicts).toHaveLength(0);
  });

  it('detects conflicts between drafts on the same day', () => {
    const drafts = [
      makeDraft({ id: 'draft-a', startTime: '09:00', durationMinutes: 60 }),
      makeDraft({ id: 'draft-b', startTime: '09:30', durationMinutes: 60 }),
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

  it('allows adjacent drafts and drafts on different days', () => {
    const drafts = [
      makeDraft({ id: 'draft-a', startTime: '09:00', durationMinutes: 60 }),
      makeDraft({ id: 'draft-b', startTime: '10:00', durationMinutes: 60 }),
      makeDraft({
        id: 'draft-c',
        date: '2026-09-09',
        startTime: '09:30',
        durationMinutes: 60,
      }),
    ];

    expect(validateScheduleByDate(drafts, []).isValid).toBe(true);
  });

  it('does not conflict with the existing version of a reordered task', () => {
    const existing = [makeTask({ id: 'task-1', startTime: '09:00' })];
    const drafts = [
      makeDraft({ id: 'task-1', startTime: '10:00', durationMinutes: 60 }),
    ];

    expect(validateScheduleByDate(drafts, existing).isValid).toBe(true);
  });

  it('moves suggestions past other occupied tasks', () => {
    const existing = [
      makeTask({ id: 'meeting', startTime: '09:00', durationMinutes: 60 }),
      makeTask({
        id: 'next-meeting',
        startTime: '10:15',
        durationMinutes: 60,
      }),
    ];
    const drafts = [makeDraft({ startTime: '09:00', durationMinutes: 60 })];

    const conflicts = detectConflicts(drafts, existing);
    const alternatives = conflicts[0].suggestedSlots.filter(
      (slot) => !slot.isKeepOriginal,
    );

    expect(alternatives[0].startTime).toBe('11:15');
    expect(alternatives.some((slot) => slot.startTime === '10:15')).toBe(false);
  });

  it('keeps suggestions clear of other drafts in the plan', () => {
    const existing = [
      makeTask({ id: 'meeting', startTime: '09:00', durationMinutes: 60 }),
    ];
    const drafts = [
      makeDraft({ id: 'draft-target', startTime: '09:00', durationMinutes: 60 }),
      makeDraft({
        id: 'draft-blocker',
        startTime: '10:15',
        durationMinutes: 120,
      }),
    ];

    const targetConflict = detectConflicts(drafts, existing).find(
      (conflict) => conflict.draftTaskId === 'draft-target',
    );
    const alternatives = targetConflict?.suggestedSlots.filter(
      (slot) => !slot.isKeepOriginal,
    );

    expect(alternatives?.[0].startTime).toBe('12:15');
  });

  it('offers only the explicit keep-original override when no free slot exists', () => {
    const existing = [
      makeTask({ startTime: '08:00', durationMinutes: 13 * 60 + 30 }),
    ];
    const drafts = [makeDraft({ startTime: '09:00', durationMinutes: 60 })];

    const conflicts = detectConflicts(drafts, existing);

    expect(conflicts[0].suggestedSlots).toHaveLength(1);
    expect(conflicts[0].suggestedSlots[0].isKeepOriginal).toBe(true);
  });
});
