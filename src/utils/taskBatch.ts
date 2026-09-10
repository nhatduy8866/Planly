import { addDays, fromDateKey, toDateKey } from './date';
import type { TaskRecurrenceRule } from '../types/recurrence';

export const MAX_BATCH_RANGE_DAYS = 366;

export type TaskBatchPattern =
  | { mode: 'weekly'; weekdays: number[] }
  | { mode: 'monthly'; monthDays: number[] };

export type TaskBatchRangeIssue = 'end_before_start' | 'range_too_long' | null;

function utcDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
      (24 * 60 * 60 * 1000),
  );
}

export function getTaskBatchRangeIssue(
  startDate: string,
  endDate: string,
): TaskBatchRangeIssue {
  const start = fromDateKey(startDate);
  const end = fromDateKey(endDate);
  const span = utcDayNumber(end) - utcDayNumber(start) + 1;

  if (span <= 0) return 'end_before_start';
  if (span > MAX_BATCH_RANGE_DAYS) return 'range_too_long';
  return null;
}

export function addCalendarMonths(dateKey: string, amount: number): string {
  const source = fromDateKey(dateKey);
  const targetMonth = source.getMonth() + amount;
  const lastDay = new Date(
    source.getFullYear(),
    targetMonth + 1,
    0,
  ).getDate();

  return toDateKey(
    new Date(
      source.getFullYear(),
      targetMonth,
      Math.min(source.getDate(), lastDay),
    ),
  );
}

export function buildTaskBatchDates(
  startDate: string,
  endDate: string,
  pattern: TaskBatchPattern,
): string[] {
  return buildTaskRecurrenceDates({
    frequency: pattern.mode,
    interval: 1,
    startDate,
    endDate,
    ...(pattern.mode === 'weekly'
      ? { weekdays: pattern.weekdays }
      : { monthDays: pattern.monthDays }),
  });
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    toDateKey(fromDateKey(value)) === value;
}

function monthDistance(start: Date, current: Date): number {
  return (current.getFullYear() - start.getFullYear()) * 12 +
    current.getMonth() - start.getMonth();
}

function mondayDayNumber(date: Date): number {
  const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  return utcDayNumber(addDays(date, offset));
}

function matchesMonthlyWeekday(
  date: Date,
  monthlyWeekday: NonNullable<TaskRecurrenceRule['monthlyWeekday']>,
): boolean {
  if (date.getDay() !== monthlyWeekday.weekday) return false;

  if (monthlyWeekday.ordinal > 0) {
    return Math.floor((date.getDate() - 1) / 7) + 1 === monthlyWeekday.ordinal;
  }

  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  return -Math.floor((lastDay - date.getDate()) / 7) - 1 ===
    monthlyWeekday.ordinal;
}

function matchesMonthDay(date: Date, monthDays: Set<number>): boolean {
  if (monthDays.has(date.getDate())) return true;
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  return monthDays.has(date.getDate() - lastDay - 1);
}

/** Expand a validated, bounded recurrence rule into occurrence date keys. */
export function buildTaskRecurrenceDates(rule: TaskRecurrenceRule): string[] {
  if (
    !isDateKey(rule.startDate) ||
    !isDateKey(rule.endDate) ||
    getTaskBatchRangeIssue(rule.startDate, rule.endDate) ||
    !Number.isInteger(rule.interval) ||
    rule.interval < 1
  ) {
    return [];
  }

  const weekdays = new Set(
    (rule.weekdays ?? []).filter(
      (value) => Number.isInteger(value) && value >= 0 && value <= 6,
    ),
  );
  const monthDays = new Set(
    (rule.monthDays ?? []).filter(
      (value) => Number.isInteger(value) && value !== 0 && value >= -31 && value <= 31,
    ),
  );
  const excludedDates = new Set(
    (rule.excludedDates ?? []).filter(isDateKey),
  );
  const count = rule.count && Number.isInteger(rule.count) && rule.count > 0
    ? Math.min(rule.count, MAX_BATCH_RANGE_DAYS)
    : undefined;
  const start = fromDateKey(rule.startDate);
  const end = fromDateKey(rule.endDate);
  const startDay = utcDayNumber(start);
  const startMonday = mondayDayNumber(start);
  const dates: string[] = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = addDays(cursor, 1)
  ) {
    let matches = false;
    if (rule.frequency === 'daily') {
      matches = (utcDayNumber(cursor) - startDay) % rule.interval === 0;
    } else if (rule.frequency === 'weekly' && weekdays.size > 0) {
      const weekIndex = Math.floor(
        (mondayDayNumber(cursor) - startMonday) / 7,
      );
      matches = weekIndex % rule.interval === 0 && weekdays.has(cursor.getDay());
    } else if (rule.frequency === 'monthly') {
      const selectedMonth = monthDistance(start, cursor) % rule.interval === 0;
      matches = selectedMonth && (
        (monthDays.size > 0 && matchesMonthDay(cursor, monthDays)) ||
        (rule.monthlyWeekday !== undefined &&
          matchesMonthlyWeekday(cursor, rule.monthlyWeekday))
      );
    }

    const dateKey = toDateKey(cursor);
    if (matches && !excludedDates.has(dateKey)) {
      dates.push(dateKey);
      if (count && dates.length >= count) break;
    }
  }

  return dates;
}
