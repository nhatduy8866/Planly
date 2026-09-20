import type { TaskPriority } from '../../types';
import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import { normalizeVietnameseText } from '../../utils/vietnameseText';
import { isAiBatchIntent } from './batchIntent';
import { resolveScheduleDate } from './dateIntent';
import { separateTimedConjunctions } from './nlpParser';
import { isReorderIntent } from './scheduleIntent';
import { isTaskUpdateIntent } from './taskUpdateIntent';
import { parseVietnameseTime } from './timeIntent';

export type AiScheduleAmbiguityCode =
  | 'multiple_times_for_single_task'
  | 'unqualified_12_hour_time';

export interface AiScheduleAmbiguity {
  code: AiScheduleAmbiguityCode;
  message: string;
  severity: 'high' | 'low';
}

export interface AiScheduleConstraints {
  ambiguities: AiScheduleAmbiguity[];
  date?: string;
  expectedTaskCount?: number;
  priority?: TaskPriority;
  startTime?: string;
}

export type AiScheduleExecutionRoute = 'flash' | 'flash_lite' | 'offline';

export interface AiScheduleRequestAnalysis {
  constraints: AiScheduleConstraints;
  route: AiScheduleExecutionRoute;
}

const RAW_TIME_PATTERN =
  /(?:(?:(?:buoi)\s+)?(sang|trua|chieu|toi)\s*)?(?:(?:vao\s+)?(?:luc\s+)?|sang\s+|thanh\s+)?(\d{1,2})(?:h(?:\d{1,2})?|:\d{2})(?:\s*(?:(?:buoi)\s+)?(sang|trua|chieu|toi))?/g;

function explicitTaskCount(prompt: string): number | undefined {
  const normalized = normalizeVietnameseText(prompt);
  const explicitCount = normalized.match(
    /\b(\d{1,2})\s*(?:cong\s+viec|viec|tasks?)\b/,
  );
  if (explicitCount) {
    const count = Number(explicitCount[1]);
    if (count > 0 && count <= 20) return count;
  }

  const timedClauses = separateTimedConjunctions(prompt)
    .split(/[;\n]/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  return timedClauses.length > 1 ? timedClauses.length : undefined;
}

function explicitPriority(prompt: string): TaskPriority | undefined {
  const normalized = normalizeVietnameseText(prompt);
  if (
    prompt.toLocaleLowerCase('vi').includes('gấp') ||
    /\b(?:viec gap|gap lam ngay|khan cap|rat quan trong|uu\s+tien\s+(?:rat\s+)?cao|hang dau)\b/.test(
      normalized,
    )
  ) {
    return 'high';
  }
  if (/\b(?:quan trong|(?:muc\s+)?uu\s+tien\s+(?:la\s+)?vua)\b/.test(normalized)) {
    return 'medium';
  }
  if (/\b(?:uu\s+tien\s+(?:la\s+)?thap|ranh thi lam|khong gap)\b/.test(normalized)) {
    return 'low';
  }
  return undefined;
}

function timeAmbiguities(
  prompt: string,
  expectedTaskCount: number | undefined,
): AiScheduleAmbiguity[] {
  const normalized = normalizeVietnameseText(prompt);
  const ambiguities: AiScheduleAmbiguity[] = [];

  const firstTime = parseVietnameseTime(prompt);
  const lastTime = parseVietnameseTime(prompt, true);
  if (
    firstTime &&
    lastTime &&
    firstTime.startTime !== lastTime.startTime &&
    (expectedTaskCount === undefined || expectedTaskCount === 1)
  ) {
    ambiguities.push({
      code: 'multiple_times_for_single_task',
      message:
        'The request contains multiple times but does not clearly assign them to separate tasks.',
      severity: 'high',
    });
  }

  for (const match of normalized.matchAll(RAW_TIME_PATTERN)) {
    const hour = Number(match[2]);
    const hasDayPeriod = Boolean(match[1] || match[3]);
    if (hour >= 1 && hour <= 12 && !hasDayPeriod) {
      ambiguities.push({
        code: 'unqualified_12_hour_time',
        message: `${hour}h does not specify morning, afternoon, or evening.`,
        severity: 'low',
      });
      break;
    }
  }

  return ambiguities;
}

export function extractScheduleConstraints(
  prompt: string,
  context: Pick<AiSchedulingContext, 'realToday' | 'targetDate'>,
): AiScheduleConstraints {
  const expectedTaskCount = explicitTaskCount(prompt);
  const parsedTime = parseVietnameseTime(prompt);
  const dateResolution = resolveScheduleDate(prompt, context);
  const hasRecurrence = isAiBatchIntent(prompt);
  const ambiguities = timeAmbiguities(prompt, expectedTaskCount);

  return {
    ambiguities,
    ...(dateResolution.hasExplicitDate && !hasRecurrence
      ? { date: dateResolution.date }
      : {}),
    ...(expectedTaskCount !== undefined ? { expectedTaskCount } : {}),
    ...(explicitPriority(prompt) !== undefined
      ? { priority: explicitPriority(prompt) }
      : {}),
    ...(parsedTime && ambiguities.length === 0
      ? { startTime: parsedTime.startTime }
      : {}),
  };
}

function hasReliableLocalResult(
  prompt: string,
  localDrafts: AiDraftTask[],
  constraints: AiScheduleConstraints,
): boolean {
  if (localDrafts.length !== 1 || localDrafts[0].batchGroupId) return false;
  if (constraints.ambiguities.length > 0) return false;
  if (isAiBatchIntent(prompt)) return false;

  const title = normalizeVietnameseText(localDrafts[0].title).trim();
  if (!title || /^cong viec(?:\s+\d+)?$/.test(title)) return false;

  const normalized = normalizeVietnameseText(prompt);
  const hasExplicitConstraint = Boolean(
    constraints.date ||
    constraints.startTime ||
    constraints.priority ||
    constraints.expectedTaskCount,
  );
  if (
    !hasExplicitConstraint &&
    /^(?:tao|them|len lich|lap lich)\b/.test(normalized)
  ) {
    return false;
  }
  const hasComplexConstraint =
    /\b(?:sau khi|truoc khi|truoc \d|sau \d|tranh|khong trung|han chot|deadline|neu|tuy|phu thuoc)\b/.test(
      normalized,
    );
  if (hasComplexConstraint) return false;

  return prompt.trim().length <= 120;
}

export function analyzeScheduleRequest(
  prompt: string,
  context: AiSchedulingContext,
  localDrafts: AiDraftTask[],
): AiScheduleRequestAnalysis {
  const constraints = extractScheduleConstraints(prompt, context);

  if (isReorderIntent(prompt)) return { constraints, route: 'offline' };
  if (isTaskUpdateIntent(prompt) && localDrafts.length > 0) {
    return { constraints, route: 'offline' };
  }
  if (hasReliableLocalResult(prompt, localDrafts, constraints)) {
    return { constraints, route: 'offline' };
  }

  const normalized = normalizeVietnameseText(prompt);
  let complexity = 0;
  if (isAiBatchIntent(prompt)) complexity += 3;
  if ((constraints.expectedTaskCount ?? 1) > 1) complexity += 3;
  if (isTaskUpdateIntent(prompt)) complexity += 3;
  if (constraints.ambiguities.some((item) => item.severity === 'high')) {
    complexity += 3;
  } else if (constraints.ambiguities.length > 0) {
    complexity += 1;
  }
  if (/\b(?:han chot|deadline|tranh|sau khi|truoc khi)\b/.test(normalized)) {
    complexity += 1;
  }
  if ((prompt.match(/[,;\n]/g)?.length ?? 0) >= 2) complexity += 1;
  if (prompt.trim().length > 160) complexity += 1;

  return {
    constraints,
    route: complexity >= 3 ? 'flash' : 'flash_lite',
  };
}
