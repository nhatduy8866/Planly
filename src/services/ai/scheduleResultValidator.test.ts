import { describe, expect, it } from '@jest/globals';

import type { AiDraftTask } from '../../types/ai';
import {
  validateAiRefinementResult,
  validateAiScheduleResult,
} from './scheduleResultValidator';

function draft(overrides: Partial<AiDraftTask> = {}): AiDraftTask {
  return {
    id: 'draft-1',
    title: 'Đá bóng',
    date: '2026-09-10',
    startTime: '14:00',
    reminderMinutes: 0,
    priority: 'medium',
    source: 'direct_request',
    ...overrides,
  };
}

describe('validateAiScheduleResult', () => {
  const prompt =
    'tao lich 2h chieu da bong, muc uu tien vua, thoi luong 1h30p nhac dung gio';
  const localDrafts = [draft()];

  it('accepts a result that preserves the requested task and attributes', () => {
    expect(validateAiScheduleResult(prompt, [draft()], localDrafts)).toEqual({
      issues: [],
      valid: true,
    });
  });

  it('rejects metadata that the model turned into another task', () => {
    const result = validateAiScheduleResult(
      prompt,
      [
        draft(),
        draft({
          id: 'draft-2',
          title: 'Muc uu tien vua va thoi luong 1h30p',
          startTime: '01:30',
        }),
      ],
      localDrafts,
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['attribute_only_task', 'task_count_mismatch']),
    );
  });

  it('rejects duplicate IDs and duplicate semantic tasks', () => {
    const result = validateAiScheduleResult(
      'tao 2 viec',
      [draft(), draft()],
      [draft(), draft({ id: 'local-2' })],
    );

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate_id', 'duplicate_task']),
    );
  });

  it('reports incorrect time, priority, and reminder fields', () => {
    const result = validateAiScheduleResult(
      prompt,
      [
        draft({
          startTime: '01:30',
          priority: 'none',
          reminderMinutes: 15,
        }),
      ],
      localDrafts,
    );

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'start_time_mismatch',
        'priority_mismatch',
        'reminder_mismatch',
      ]),
    );
  });

  it('requires refinement to preserve IDs unless add or remove was requested', () => {
    const current = [draft({ id: 'existing-1' })];
    const result = validateAiRefinementResult(
      'doi gio da bong sang 15h',
      current,
      [draft({ id: 'hallucinated-id', startTime: '15:00' })],
      [draft({ id: 'existing-1', startTime: '15:00' })],
    );

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unexpected_new_task', 'missing_existing_task']),
    );
  });
});
