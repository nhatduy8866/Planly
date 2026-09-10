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

  it('requires a clear recurrence request to return a grouped result', () => {
    const localBatch = [
      draft({ id: 'local-1', date: '2026-09-07', batchGroupId: 'local-batch' }),
      draft({ id: 'local-2', date: '2026-09-09', batchGroupId: 'local-batch' }),
    ];
    const result = validateAiScheduleResult(
      'tap gym moi thu 2, thu 4 den ngay 09/09/2026',
      [
        draft({ id: 'cloud-1', date: '2026-09-07' }),
        draft({ id: 'cloud-2', date: '2026-09-09' }),
      ],
      localBatch,
    );

    expect(result.issues.map((issue) => issue.code)).toContain('batch_mismatch');
  });

  it('accepts valid recurrence dates without treating local parsing as ground truth', () => {
    const localBatch = [
      draft({ id: 'local-1', date: '2026-09-07', batchGroupId: 'local-batch' }),
      draft({ id: 'local-2', date: '2026-09-09', batchGroupId: 'local-batch' }),
    ];
    const cloudBatch = [
      draft({ id: 'cloud-1', date: '2026-09-07', batchGroupId: 'cloud-batch' }),
      draft({ id: 'cloud-2', date: '2026-09-11', batchGroupId: 'cloud-batch' }),
    ];

    expect(
      validateAiScheduleResult(
        'tap gym moi thu 2, thu 4 den ngay 09/09/2026',
        cloudBatch,
        localBatch,
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
      localDrafts,
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
      localDrafts,
    );

    expect(result.issues.map((issue) => issue.code)).toContain('batch_mismatch');
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
