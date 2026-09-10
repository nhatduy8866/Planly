import type { AiSchedulingContext } from '../../types/ai';
import type {
  MonthlyWeekdayRule,
  TaskRecurrenceFrequency,
  TaskRecurrenceRule,
} from '../../types/recurrence';
import { fromDateKey } from '../../utils/date';
import {
  normalizeVietnameseText,
  replaceVietnameseMatches,
} from '../../utils/vietnameseText';
import {
  addCalendarMonths,
  buildTaskRecurrenceDates,
} from '../../utils/taskBatch';
import { resolveScheduleDate } from './dateIntent';

export interface AiBatchSchedule {
  dates: string[];
  mode: TaskRecurrenceFrequency;
  rule: TaskRecurrenceRule;
}

export class AiBatchScheduleError extends Error {
  constructor() {
    super('The recurring schedule range is invalid or longer than one year.');
    this.name = 'AiBatchScheduleError';
  }
}

function requireBatchSchedule(
  dates: string[],
  mode: AiBatchSchedule['mode'],
): Pick<AiBatchSchedule, 'dates' | 'mode'> {
  if (!dates.length) throw new AiBatchScheduleError();
  return { dates, mode };
}

const DATE_EXPRESSION =
  '(?:\\d{4}-\\d{2}-\\d{2}|(?:ngay\\s+)?\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{4})?|ngay\\s+\\d{1,2}\\s+thang\\s+\\d{1,2}(?:\\s+nam\\s+\\d{4})?|hom\\s+nay|ngay\\s+mai|mai|ngay\\s+kia|ngay\\s+mot)';

const WEEKDAY_VALUES: Record<string, number> = {
  'chu nhat': 0,
  'thu 2': 1,
  'thu hai': 1,
  'thu 3': 2,
  'thu ba': 2,
  'thu 4': 3,
  'thu tu': 3,
  'thu 5': 4,
  'thu nam': 4,
  'thu 6': 5,
  'thu sau': 5,
  'thu 7': 6,
  'thu bay': 6,
};

export function isAiBatchIntent(text: string): boolean {
  const normalized = normalizeVietnameseText(text);
  return /\b(?:moi\s+(?:(?:buoi\s+)?(?:sang|trua|chieu|toi)|ngay|tuan|thang|thu)|hang\s+(?:ngay|tuan|thang)|cac\s+thu|lap\s+lai|dinh\s+ky|cu\s+(?:\d+\s+)?(?:ngay|tuan|thang|cach\s+nhat|nhat)|cach\s+(?:\d+\s+ngay|nhat|ngay)|every\s+(?:day|week|month))\b/.test(
    normalized,
  );
}

function resolveBoundDate(
  normalized: string,
  kind: 'start' | 'end',
  context: AiSchedulingContext,
): string | null {
  const prefix = kind === 'start'
    ? '(?:bat\\s+dau\\s+)?tu'
    : '(?:cho\\s+)?den';
  const match = normalized.match(
    new RegExp(`\\b${prefix}\\s+(${DATE_EXPRESSION})(?=$|[\\s,.!?])`),
  );
  return match ? resolveScheduleDate(match[1], context).date : null;
}

/** Explicit user bounds are deterministic constraints, not model suggestions. */
export function resolveAiRecurrenceEndDate(
  text: string,
  context: AiSchedulingContext,
): string | null {
  const normalized = normalizeVietnameseText(text).replace(/\s+/g, ' ').trim();
  return resolveBoundDate(normalized, 'end', context);
}

function parseWeekdays(text: string): number[] {
  const values = new Set<number>();
  const weekdayPattern =
    /\b(thu\s*(?:[2-7]|hai|ba|tu|nam|sau|bay)|chu\s*nhat)\b/g;

  for (const match of text.matchAll(weekdayPattern)) {
    const key = match[1].replace(/\s+/g, ' ').trim();
    const value = WEEKDAY_VALUES[key];
    if (value !== undefined) values.add(value);
  }

  for (const match of text.matchAll(
    /\bthu\s*[2-7](?:\s*(?:,|\/|&|va)\s*(?:thu\s*)?[2-7])+/g,
  )) {
    for (const digit of match[0].match(/[2-7]/g) ?? []) {
      values.add(Number(digit) - 1);
    }
  }

  return Array.from(values).sort((first, second) => first - second);
}

function parseMonthDays(text: string): number[] {
  const values = new Set<number>();
  for (const match of text.matchAll(
    /\bngay\s+(\d{1,2}(?:\s*(?:,|\/|&|va)\s*(?:ngay\s+)?\d{1,2})*)/g,
  )) {
    for (const rawValue of match[1].match(/\d{1,2}/g) ?? []) {
      const value = Number(rawValue);
      if (value >= 1 && value <= 31) values.add(value);
    }
  }
  return Array.from(values).sort((first, second) => first - second);
}

function parseInterval(
  text: string,
  frequency: TaskRecurrenceFrequency,
): number {
  if (frequency === 'daily') {
    if (/\b(?:cu\s+)?cach\s+nhat\b/.test(text)) {
      return 2;
    }
    const dayIntervalMatch = text.match(/\b(?:cu|cach)\s+(\d{1,2})\s+ngay\b/);
    if (dayIntervalMatch) {
      return Math.max(1, Number(dayIntervalMatch[1]));
    }
  }
  const unit = frequency === 'daily'
    ? 'ngay'
    : frequency === 'weekly'
      ? 'tuan'
      : 'thang';
  const match = text.match(
    new RegExp(`\\b(?:moi|cach|cu)\\s+(\\d{1,2})\\s+${unit}\\b`),
  );
  return match ? Math.max(1, Number(match[1])) : 1;
}

function parseMonthlyWeekday(text: string): MonthlyWeekdayRule | undefined {
  const match = text.match(
    /\b(thu\s*(?:[2-7]|hai|ba|tu|nam|sau|bay)|chu\s*nhat)\s+(dau(?:\s+tien)?|cuoi)\s+(?:moi\s+|hang\s+)?thang\b/,
  );
  if (!match) return undefined;
  const weekday = WEEKDAY_VALUES[match[1].replace(/\s+/g, ' ').trim()];
  if (weekday === undefined) return undefined;
  return { weekday, ordinal: match[2].startsWith('cuoi') ? -1 : 1 };
}

export function parseAiRecurrenceRule(
  text: string,
  context: AiSchedulingContext,
  fallbackEndDate?: string | null,
): TaskRecurrenceRule | null {
  if (!isAiBatchIntent(text)) return null;

  const normalized = normalizeVietnameseText(text).replace(/\s+/g, ' ').trim();
  const startDate = resolveBoundDate(normalized, 'start', context)
    ?? context.targetDate;
  const endDate = resolveAiRecurrenceEndDate(normalized, context)
    ?? fallbackEndDate
    ?? addCalendarMonths(startDate, 3);
  const recurrenceClause = normalized
    .split(/\b(?:cho\s+)?den\b/)[0]
    .replace(
      new RegExp(`\\b(?:bat\\s+dau\\s+)?tu\\s+${DATE_EXPRESSION}`),
      ' ',
    );
  const weekdays = parseWeekdays(recurrenceClause);
  const monthDays = parseMonthDays(recurrenceClause);
  const monthlyWeekday = parseMonthlyWeekday(recurrenceClause);
  const hasMonthCue = /\b(?:moi|hang)\s+thang\b/.test(normalized);
  const hasWeekCue = /\b(?:moi|hang)\s+tuan\b/.test(normalized);
  const hasDailyCue = /\b(?:moi\s+(?:(?:buoi\s+)?(?:sang|trua|chieu|toi)|ngay)|hang\s+ngay|cu\s+(?:\d+\s+ngay|cach\s+nhat|nhat)|cach\s+nhat|cach\s+\d+\s+ngay|every\s+day)\b/.test(
    normalized,
  );

  // Prefer the semantic selector over a loose frequency word. For example,
  // explicit weekdays describe a weekly rule even if the sentence also says
  // "hàng tháng" conversationally. Ordinals remain a true monthly selector.
  let frequency: TaskRecurrenceFrequency;
  if (monthlyWeekday) frequency = 'monthly';
  else if (weekdays.length) frequency = 'weekly';
  else if (hasMonthCue && monthDays.length) frequency = 'monthly';
  else if (hasDailyCue) frequency = 'daily';
  else if (hasWeekCue) frequency = 'weekly';
  else if (hasMonthCue) frequency = 'monthly';
  else return null;

  const rule: TaskRecurrenceRule = {
    frequency,
    interval: parseInterval(normalized, frequency),
    startDate,
    endDate,
  };
  if (frequency === 'weekly') {
    rule.weekdays = weekdays.length
      ? weekdays
      : [fromDateKey(startDate).getDay()];
  } else if (frequency === 'monthly') {
    if (monthlyWeekday) rule.monthlyWeekday = monthlyWeekday;
    else {
      rule.monthDays = monthDays.length
        ? monthDays
        : [fromDateKey(startDate).getDate()];
    }
  }
  return rule;
}

export function parseAiBatchSchedule(
  text: string,
  context: AiSchedulingContext,
  fallbackEndDate?: string | null,
): AiBatchSchedule | null {
  const rule = parseAiRecurrenceRule(text, context, fallbackEndDate);
  if (!rule) return null;
  const dates = buildTaskRecurrenceDates(rule);
  return { ...requireBatchSchedule(dates, rule.frequency), rule };
}

export function stripAiBatchScheduleReferences(text: string): string {
  if (!isAiBatchIntent(text)) return text;

  let result = replaceVietnameseMatches(
    text,
    new RegExp(
      `\\b(?:(?:bat\\s+dau\\s+)?tu|(?:cho\\s+)?den)\\s+${DATE_EXPRESSION}(?=$|[\\s,.!?])`,
      'g',
    ),
  );
  result = replaceVietnameseMatches(
    result,
    /\b(?:vao\s+)?(?:thu\s*(?:[2-7]|hai|ba|tu|nam|sau|bay)|chu\s*nhat)\s+(?:dau(?:\s+tien)?|cuoi)\s+(?:moi\s+|hang\s+)?thang\b/g,
  );
  result = replaceVietnameseMatches(
    result,
    /(?:\s*(?:,|\/|&|va)\s*)(?:thu\s*)?(?:[2-7]|hai|ba|tu|nam|sau|bay)(?=$|[\s,.!?])/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\b(?:vao\s+)?(?:(?:moi|cac)\s+)?(?:thu\s*(?:[2-7]|hai|ba|tu|nam|sau|bay)|chu\s*nhat)\b/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\b(?:vao\s+)?(?:moi\s+(?:(?:buoi\s+)?(?:sang|trua|chieu|toi)|ngay|tuan|thang)|hang\s+(?:ngay|tuan|thang)|moi\s+thu|cac\s+thu|lap\s+lai|dinh\s+ky)\b/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\b(?:vao\s+)?(?:cu\s+(?:\d+\s+)?(?:ngay|tuan|thang|cach\s+nhat|nhat)|cach\s+nhat|cach\s+\d+\s+ngay)\b/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\b(?:vao\s+)?ngay\s+\d{1,2}(?=$|[\s,.!?])/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\bva\b(?=\s*(?:$|[,.;]))/g,
  );
  result = replaceVietnameseMatches(result, /^\s*(?:va\s+|se\s+)+/g);
  return result
    .replace(/\s*[,.;]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
