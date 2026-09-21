import { describe, expect, it } from '@jest/globals';

import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
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
    priority: 'medium',
    source: 'direct_request',
    ...overrides,
  };
}

describe('validateAiScheduleResult', () => {
  const prompt = 'tao 1 viec luc 2h chieu da bong, muc uu tien vua';
  const context: AiSchedulingContext = {
    realToday: '2026-09-10',
    realTodayDayName: 'Thứ Năm, 10 tháng 9 năm 2026',
    targetDate: '2026-09-10',
    currentDayName: 'Thứ Năm, 10 tháng 9 năm 2026',
    existingTasks: [],
  };

  it('accepts a result that preserves the requested task and attributes', () => {
    expect(validateAiScheduleResult(prompt, [draft()], context)).toEqual({
      ambiguities: [],
      ambiguityLevel: 'none',
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
          title: 'Muc uu tien vua',
          startTime: '01:30',
        }),
      ],
      context,
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
      context,
    );

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate_id', 'duplicate_task']),
    );
  });

  it('reports incorrect time and priority fields', () => {
    const result = validateAiScheduleResult(
      prompt,
      [
        draft({
          startTime: '01:30',
          priority: 'none',
        }),
      ],
      context,
    );

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['start_time_mismatch', 'priority_mismatch']),
    );
  });

  it('requires a clear recurrence request to return a grouped result', () => {
    const result = validateAiScheduleResult(
      'tap gym moi thu 2, thu 4 den ngay 09/09/2026',
      [
        draft({ id: 'cloud-1', date: '2026-09-07' }),
        draft({ id: 'cloud-2', date: '2026-09-09' }),
      ],
      context,
    );

    expect(result.issues.map((issue) => issue.code)).toContain('batch_mismatch');
  });

  it('accepts valid recurrence dates without treating local parsing as ground truth', () => {
    const cloudBatch = [
      draft({ id: 'cloud-1', date: '2026-09-07', batchGroupId: 'cloud-batch' }),
      draft({ id: 'cloud-2', date: '2026-09-11', batchGroupId: 'cloud-batch' }),
    ];

    expect(
      validateAiScheduleResult(
        'tap gym moi thu 2, thu 4 den ngay 09/09/2026',
        cloudBatch,
        context,
      ).valid,
    ).toBe(true);
  });

  it('accepts a structurally valid AI recurrence even if local cue detection misses it', () => {
    const result = validateAiScheduleResult(
      'tao lich theo nhip rieng da duoc cau hinh',
      [
        draft({ id: 'cloud-1', date: '2026-09-10', batchGroupId: 'cloud-batch' }),
        draft({ id: 'cloud-2', date: '2026-09-12', batchGroupId: 'cloud-batch' }),
      ],
      context,
    );

    expect(result.valid).toBe(true);
  });

  it('rejects inconsistent or duplicate occurrences inside a batch', () => {
    const result = validateAiScheduleResult(
      'tao lich tap gym lap lai',
      [
        draft({ id: 'cloud-1', batchGroupId: 'cloud-batch' }),
        draft({
          id: 'cloud-2',
          title: 'Việc khác',
          batchGroupId: 'cloud-batch',
        }),
      ],
      context,
    );

    expect(result.issues.map((issue) => issue.code)).toContain('batch_mismatch');
  });

  it('requires refinement to preserve IDs unless add or remove was requested', () => {
    const current = [draft({ id: 'existing-1' })];
    const result = validateAiRefinementResult(
      'doi gio da bong sang 15h',
      current,
      [draft({ id: 'hallucinated-id', startTime: '15:00' })],
      context,
    );

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unexpected_new_task', 'missing_existing_task']),
    );
  });

  it('accepts a cloud interpretation when the prompt has no explicit time constraint', () => {
    const result = validateAiScheduleResult(
      'hoàn thành báo cáo',
      [draft({ startTime: '16:00' })],
      context,
    );

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports ambiguity instead of forcing an unqualified 12-hour time', () => {
    const result = validateAiScheduleResult(
      '9h gặp khách hàng',
      [draft({ startTime: '21:00' })],
      context,
    );

    expect(result.valid).toBe(true);
    expect(result.ambiguityLevel).toBe('low');
    expect(result.ambiguities.map((item) => item.code)).toContain(
      'unqualified_12_hour_time',
    );
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      'start_time_mismatch',
    );
  });

  it('rejects a result that violates an explicit date constraint', () => {
    const result = validateAiScheduleResult(
      'ngày mai họp khách hàng lúc 14h',
      [draft({ date: '2026-09-12' })],
      context,
    );

    expect(result.issues.map((issue) => issue.code)).toContain(
      'explicit_date_mismatch',
    );
  });
});
