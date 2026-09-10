import type { AiSchedulingContext } from '../../types/ai';
import { fromDateKey } from '../../utils/date';
import {
  normalizeVietnameseText,
  replaceVietnameseMatches,
} from '../../utils/vietnameseText';
import {
  addCalendarMonths,
  buildTaskBatchDates,
} from '../../utils/taskBatch';
import { resolveScheduleDate } from './dateIntent';

export interface AiBatchSchedule {
  dates: string[];
  mode: 'weekly' | 'monthly';
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
): AiBatchSchedule {
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
  return /\b(?:moi\s+(?:ngay|tuan|thang|thu)|hang\s+(?:tuan|thang)|cac\s+thu)\b/.test(
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
  for (const match of text.matchAll(/\bngay\s+(\d{1,2})\b/g)) {
    const value = Number(match[1]);
    if (value >= 1 && value <= 31) values.add(value);
  }
  return Array.from(values).sort((first, second) => first - second);
}

export function parseAiBatchSchedule(
  text: string,
  context: AiSchedulingContext,
): AiBatchSchedule | null {
  if (!isAiBatchIntent(text)) return null;

  const normalized = normalizeVietnameseText(text).replace(/\s+/g, ' ').trim();
  const mode = /\b(?:moi|hang)\s+thang\b/.test(normalized)
    ? 'monthly'
    : 'weekly';
  const startDate = resolveBoundDate(normalized, 'start', context)
    ?? context.targetDate;
  const endDate = resolveBoundDate(normalized, 'end', context)
    ?? addCalendarMonths(startDate, 3);
  const recurrenceClause = normalized
    .split(/\b(?:cho\s+)?den\b/)[0]
    .replace(
      new RegExp(`\\b(?:bat\\s+dau\\s+)?tu\\s+${DATE_EXPRESSION}`),
      ' ',
    );

  if (mode === 'monthly') {
    const monthDays = parseMonthDays(recurrenceClause);
    const dates = buildTaskBatchDates(startDate, endDate, {
      mode,
      monthDays: monthDays.length
        ? monthDays
        : [fromDateKey(startDate).getDate()],
    });
    return requireBatchSchedule(dates, mode);
  }

  const isDaily = /\bmoi\s+ngay\b/.test(normalized);
  const weekdays = isDaily
    ? [0, 1, 2, 3, 4, 5, 6]
    : parseWeekdays(recurrenceClause);
  const dates = buildTaskBatchDates(startDate, endDate, {
    mode,
    weekdays: weekdays.length
      ? weekdays
      : [fromDateKey(startDate).getDay()],
  });
  return requireBatchSchedule(dates, mode);
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
    /\b(?:vao\s+)?(?:(?:moi|cac)\s+)?(?:thu\s*(?:[2-7]|hai|ba|tu|nam|sau|bay)|chu\s*nhat)\b/g,
  );
  result = replaceVietnameseMatches(
    result,
    /(?:\s*(?:,|\/|&|va)\s*)(?:thu\s*)?[2-7](?=$|[\s,.!?])/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\b(?:vao\s+)?(?:moi\s+(?:ngay|tuan|thang)|hang\s+(?:tuan|thang)|moi\s+thu|cac\s+thu)\b/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\b(?:vao\s+)?ngay\s+\d{1,2}(?=$|[\s,.!?])/g,
  );
  result = replaceVietnameseMatches(
    result,
    /\bva\b(?=\s*(?:$|[,.;]))/g,
  );
  return result
    .replace(/\s*[,.;]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
