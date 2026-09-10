import type { AiDraftTask } from '../../types/ai';
import {
  isVietnameseTaskAttributeClause,
  normalizeVietnameseText,
  replaceVietnameseMatches,
} from '../../utils/vietnameseText';
import { getTaskBatchRangeIssue } from '../../utils/taskBatch';
import { parseVietnameseTime } from './timeIntent';
import { isAiBatchIntent } from './batchIntent';
import { isValidDateKey } from './dateIntent';
import { separateTimedConjunctions } from './nlpParser';

export type AiScheduleValidationCode =
  | 'attribute_only_task'
  | 'batch_mismatch'
  | 'duplicate_id'
  | 'duplicate_task'
  | 'empty_result'
  | 'missing_existing_task'
  | 'priority_mismatch'
  | 'reminder_mismatch'
  | 'start_time_mismatch'
  | 'task_count_mismatch'
  | 'unexpected_new_task';

export interface AiScheduleValidationIssue {
  code: AiScheduleValidationCode;
  message: string;
}

export interface AiScheduleValidationResult {
  issues: AiScheduleValidationIssue[];
  valid: boolean;
}

const DURATION_PATTERN =
  /(?:thoi\s+luong|keo\s+dai)\s*(?:la\s+)?\d+\s*(?:(?:h|gio)(?:\s*\d+\s*(?:p|phut))?|p|phut)/g;

function expectedTaskCount(
  prompt: string,
  localDrafts: AiDraftTask[],
): number | undefined {
  const normalized = normalizeVietnameseText(prompt);
  if (isAiBatchIntent(prompt) && localDrafts.length > 0) {
    return logicalTaskCount(localDrafts);
  }
  const timedClauses = separateTimedConjunctions(prompt).split(';');
  if (timedClauses.length > 1 && localDrafts.length > 1) {
    return localDrafts.length;
  }
  const explicitCount = normalized.match(
    /\b(\d{1,2})\s*(?:cong\s+viec|viec|tasks?)\b/,
  );
  if (explicitCount) {
    const count = Number(explicitCount[1]);
    if (count > 0 && count <= 20) return count;
  }

  const hasAttributeClause =
    /(?:muc\s+)?uu\s+tien|thoi\s+luong|keo\s+dai|(?:nhac|bao)\s+(?:truoc|dung\s+(?:gio|hen))/.test(
      normalized,
    );
  return hasAttributeClause && localDrafts.length > 0
    ? localDrafts.length
    : undefined;
}

function batchGroups(drafts: AiDraftTask[]): Map<string, AiDraftTask[]> {
  const groups = new Map<string, AiDraftTask[]>();
  for (const draft of drafts) {
    if (!draft.batchGroupId) continue;
    const group = groups.get(draft.batchGroupId) ?? [];
    group.push(draft);
    groups.set(draft.batchGroupId, group);
  }
  return groups;
}

function logicalTaskCount(drafts: AiDraftTask[]): number {
  const groups = batchGroups(drafts);
  return groups.size + drafts.filter((draft) => !draft.batchGroupId).length;
}

function hasInvalidBatch(drafts: AiDraftTask[]): boolean {
  for (const group of batchGroups(drafts).values()) {
    const dates = group.map((draft) => draft.date).sort();
    const first = group[0];
    if (
      group.length < 2 ||
      new Set(dates).size !== dates.length ||
      dates.some((date) => !isValidDateKey(date)) ||
      getTaskBatchRangeIssue(dates[0], dates[dates.length - 1]) ||
      group.some((draft) =>
        draft.title !== first.title ||
        draft.startTime !== first.startTime ||
        draft.priority !== first.priority ||
        draft.reminderMinutes !== first.reminderMinutes)
    ) {
      return true;
    }
  }
  return false;
}

function hasExplicitReminder(prompt: string): boolean {
  return /\b(?:nhac|bao)\b/.test(normalizeVietnameseText(prompt));
}

function hasExplicitPriority(prompt: string): boolean {
  return /\b(?:uu\s+tien|gap|khan\s+cap|quan\s+trong|khong\s+gap)\b/.test(
    normalizeVietnameseText(prompt),
  );
}

function hasExplicitStartTime(prompt: string): boolean {
  const withoutDuration = replaceVietnameseMatches(prompt, DURATION_PATTERN);
  return parseVietnameseTime(withoutDuration) !== null;
}

export function validateAiScheduleResult(
  prompt: string,
  drafts: AiDraftTask[],
  localDrafts: AiDraftTask[],
): AiScheduleValidationResult {
  const issues: AiScheduleValidationIssue[] = [];
  if (!drafts.length && localDrafts.length > 0) {
    issues.push({
      code: 'empty_result',
      message: 'The result did not contain any tasks.',
    });
  }

  const expectedCount = expectedTaskCount(prompt, localDrafts);
  const receivedCount = batchGroups(drafts).size > 0
    ? logicalTaskCount(drafts)
    : drafts.length;
  if (expectedCount !== undefined && receivedCount !== expectedCount) {
    issues.push({
      code: 'task_count_mismatch',
      message: `Expected ${expectedCount} logical task(s), but received ${receivedCount}. Attribute clauses must remain attached to their task.`,
    });
  }

  if (
    (isAiBatchIntent(prompt) && batchGroups(drafts).size === 0) ||
    hasInvalidBatch(drafts)
  ) {
    issues.push({
      code: 'batch_mismatch',
      message: 'The recurring task must be a valid, bounded group with unique dates and consistent task fields.',
    });
  }

  const ids = new Set<string>();
  const semanticTasks = new Set<string>();
  for (const draft of drafts) {
    if (isVietnameseTaskAttributeClause(draft.title)) {
      issues.push({
        code: 'attribute_only_task',
        message: `"${draft.title}" contains only task attributes and must not be a separate task.`,
      });
    }

    if (ids.has(draft.id)) {
      issues.push({
        code: 'duplicate_id',
        message: `Task id "${draft.id}" is duplicated.`,
      });
    }
    ids.add(draft.id);

    const semanticKey = [
      normalizeVietnameseText(draft.title).trim(),
      draft.date,
      draft.startTime,
    ].join('|');
    if (semanticTasks.has(semanticKey)) {
      issues.push({
        code: 'duplicate_task',
        message: `Task "${draft.title}" is duplicated at ${draft.startTime}.`,
      });
    }
    semanticTasks.add(semanticKey);
  }

  if (logicalTaskCount(drafts) === 1 && logicalTaskCount(localDrafts) === 1) {
    const [draft] = drafts;
    const [local] = localDrafts;
    if (
      hasExplicitStartTime(prompt) &&
      local.startTime &&
      draft.startTime !== local.startTime
    ) {
      issues.push({
        code: 'start_time_mismatch',
        message: `The requested start time resolves to ${local.startTime}, not ${draft.startTime || 'an empty value'}. A duration must not be used as startTime.`,
      });
    }
    if (
      hasExplicitReminder(prompt) &&
      draft.reminderMinutes !== local.reminderMinutes
    ) {
      issues.push({
        code: 'reminder_mismatch',
        message: `The reminder must be ${String(local.reminderMinutes)} minute(s), not ${String(draft.reminderMinutes)}.`,
      });
    }
    if (hasExplicitPriority(prompt) && draft.priority !== local.priority) {
      issues.push({
        code: 'priority_mismatch',
        message: `The priority must be "${local.priority}", not "${draft.priority}".`,
      });
    }
  }

  return { issues, valid: issues.length === 0 };
}

export function validateAiRefinementResult(
  instruction: string,
  currentDrafts: AiDraftTask[],
  drafts: AiDraftTask[],
  localDrafts: AiDraftTask[],
): AiScheduleValidationResult {
  const base = validateAiScheduleResult(instruction, drafts, localDrafts);
  const issues = [...base.issues];
  const normalizedInstruction = normalizeVietnameseText(instruction);
  const allowsNewTask = /\b(?:them|add)\b/.test(normalizedInstruction);
  const allowsRemoval = /\b(?:bo|xoa|huy|remove|delete|cancel)\b/.test(
    normalizedInstruction,
  );
  const currentIds = new Set(currentDrafts.map((draft) => draft.id));
  const resultIds = new Set(drafts.map((draft) => draft.id));

  if (!allowsNewTask) {
    for (const draft of drafts) {
      if (!currentIds.has(draft.id)) {
        issues.push({
          code: 'unexpected_new_task',
          message: `Refinement created unexpected task id "${draft.id}". Preserve existing task IDs unless the user asks to add a task.`,
        });
      }
    }
  }

  if (!allowsRemoval) {
    for (const current of currentDrafts) {
      if (!resultIds.has(current.id)) {
        issues.push({
          code: 'missing_existing_task',
          message: `Existing task id "${current.id}" was removed without a delete request.`,
        });
      }
    }
  }

  return { issues, valid: issues.length === 0 };
}
