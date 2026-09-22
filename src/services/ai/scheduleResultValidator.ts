import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import {
  isVietnameseTaskAttributeClause,
  normalizeVietnameseText,
} from '../../utils/vietnameseText';
import { getTaskBatchRangeIssue } from '../../utils/taskBatch';
import { isAiBatchIntent } from './batchIntent';
import { isValidDateKey } from './dateIntent';
import { isReorderIntent } from './scheduleIntent';
import {
  extractScheduleConstraints,
  type AiScheduleAmbiguity,
} from './scheduleRequestAnalysis';
import { isTaskUpdateIntent } from './taskUpdateIntent';

export type AiScheduleValidationCode =
  | 'attribute_only_task'
  | 'batch_mismatch'
  | 'duplicate_id'
  | 'duplicate_task'
  | 'empty_result'
  | 'explicit_date_mismatch'
  | 'invalid_date'
  | 'invalid_start_time'
  | 'missing_existing_task'
  | 'priority_mismatch'
  | 'start_time_mismatch'
  | 'task_count_mismatch'
  | 'unexpected_new_task';

export interface AiScheduleValidationIssue {
  code: AiScheduleValidationCode;
  message: string;
}

export interface AiScheduleValidationResult {
  ambiguities: AiScheduleAmbiguity[];
  ambiguityLevel: 'high' | 'low' | 'none';
  issues: AiScheduleValidationIssue[];
  valid: boolean;
}

interface AiScheduleValidationOptions {
  allowEmptyResult?: boolean;
  validateExistingTargets?: boolean;
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

function logicalTaskCount(
  drafts: AiDraftTask[],
  groups: ReadonlyMap<string, AiDraftTask[]>,
): number {
  let count = groups.size;
  for (const draft of drafts) {
    if (!draft.batchGroupId) count += 1;
  }
  return count;
}

function hasInvalidBatch(
  groups: ReadonlyMap<string, AiDraftTask[]>,
): boolean {
  for (const group of groups.values()) {
    const dates = group.map((draft) => draft.date).sort();
    const first = group[0];
    if (
      group.length < 2 ||
      first.batchGroupId?.startsWith('invalid-ai-recurrence') ||
      new Set(dates).size !== dates.length ||
      dates.some((date) => !isValidDateKey(date)) ||
      getTaskBatchRangeIssue(dates[0], dates[dates.length - 1]) ||
      group.some((draft) =>
        draft.title !== first.title ||
        draft.startTime !== first.startTime ||
        draft.priority !== first.priority)
    ) {
      return true;
    }
  }
  return false;
}

function ambiguityLevel(
  ambiguities: AiScheduleAmbiguity[],
): AiScheduleValidationResult['ambiguityLevel'] {
  if (ambiguities.some((ambiguity) => ambiguity.severity === 'high')) {
    return 'high';
  }
  return ambiguities.length > 0 ? 'low' : 'none';
}

function isValidStartTime(value: string): boolean {
  if (value === '') return true;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

export function validateAiScheduleResult(
  prompt: string,
  drafts: AiDraftTask[],
  context: AiSchedulingContext,
  options: AiScheduleValidationOptions = {},
): AiScheduleValidationResult {
  const constraints = extractScheduleConstraints(prompt, context);
  const issues: AiScheduleValidationIssue[] = [];
  const groups = batchGroups(drafts);
  const targetDate = constraints.date ?? context.targetDate;
  const activeTargetTasks = (context.allTasks || context.existingTasks).filter(
    (task) => task.date === targetDate && !task.completed,
  );
  const allowsEmptyResult =
    options.allowEmptyResult === true ||
    ((isReorderIntent(prompt) || isTaskUpdateIntent(prompt)) &&
      activeTargetTasks.length === 0);

  if (!drafts.length && !allowsEmptyResult) {
    issues.push({
      code: 'empty_result',
      message: 'The result did not contain any tasks.',
    });
  }

  const expectedCount = constraints.expectedTaskCount;
  const receivedCount = groups.size > 0
    ? logicalTaskCount(drafts, groups)
    : drafts.length;
  if (expectedCount !== undefined && receivedCount !== expectedCount) {
    issues.push({
      code: 'task_count_mismatch',
      message: `Expected ${expectedCount} logical task(s), but received ${receivedCount}. Attribute clauses must remain attached to their task.`,
    });
  }

  if (
    (isAiBatchIntent(prompt) && groups.size === 0) ||
    hasInvalidBatch(groups)
  ) {
    issues.push({
      code: 'batch_mismatch',
      message: 'The recurring task must be a valid, bounded group with unique dates and consistent task fields.',
    });
  }

  const ids = new Set<string>();
  const semanticTasks = new Set<string>();
  for (const draft of drafts) {
    if (!isValidDateKey(draft.date)) {
      issues.push({
        code: 'invalid_date',
        message: `Task "${draft.title}" has invalid date "${draft.date}".`,
      });
    }
    if (!isValidStartTime(draft.startTime)) {
      issues.push({
        code: 'invalid_start_time',
        message: `Task "${draft.title}" has invalid start time "${draft.startTime}".`,
      });
    }
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

  if (logicalTaskCount(drafts, groups) === 1) {
    const [draft] = drafts;
    if (constraints.date && draft.date !== constraints.date) {
      issues.push({
        code: 'explicit_date_mismatch',
        message: `The requested date resolves to ${constraints.date}, not ${draft.date}.`,
      });
    }
    if (constraints.startTime && draft.startTime !== constraints.startTime) {
      issues.push({
        code: 'start_time_mismatch',
        message: `The explicit start time resolves to ${constraints.startTime}, not ${draft.startTime || 'an empty value'}.`,
      });
    }
    if (constraints.priority && draft.priority !== constraints.priority) {
      issues.push({
        code: 'priority_mismatch',
        message: `The explicit priority must be "${constraints.priority}", not "${draft.priority}".`,
      });
    }
  }

  if (
    options.validateExistingTargets !== false &&
    (isReorderIntent(prompt) || isTaskUpdateIntent(prompt))
  ) {
    const knownIds = new Set(activeTargetTasks.map((task) => task.id));
    for (const draft of drafts) {
      if (!knownIds.has(draft.id)) {
        issues.push({
          code: 'unexpected_new_task',
          message: `Task id "${draft.id}" does not match an existing task targeted by this request.`,
        });
      }
    }

    if (isReorderIntent(prompt)) {
      const resultIds = new Set(drafts.map((draft) => draft.id));
      for (const task of activeTargetTasks) {
        if (!resultIds.has(task.id)) {
          issues.push({
            code: 'missing_existing_task',
            message: `Existing task id "${task.id}" is missing from the reordered schedule.`,
          });
        }
      }
    }
  }

  return {
    ambiguities: constraints.ambiguities,
    ambiguityLevel: ambiguityLevel(constraints.ambiguities),
    issues,
    valid: issues.length === 0,
  };
}

export function validateAiRefinementResult(
  instruction: string,
  currentDrafts: AiDraftTask[],
  drafts: AiDraftTask[],
  context: AiSchedulingContext,
): AiScheduleValidationResult {
  const normalizedInstruction = normalizeVietnameseText(instruction);
  const allowsNewTask = /\b(?:them|add)\b/.test(normalizedInstruction);
  const allowsRemoval = /\b(?:bo|xoa|huy|remove|delete|cancel)\b/.test(
    normalizedInstruction,
  );
  const base = validateAiScheduleResult(instruction, drafts, context, {
    allowEmptyResult: allowsRemoval,
    validateExistingTargets: false,
  });
  const issues = [...base.issues];
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

  return { ...base, issues, valid: issues.length === 0 };
}
