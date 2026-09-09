import { addDays, fromDateKey, toDateKey } from './date';

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
  if (getTaskBatchRangeIssue(startDate, endDate)) return [];

  const selectedValues = new Set(
    pattern.mode === 'weekly' ? pattern.weekdays : pattern.monthDays,
  );
  const end = fromDateKey(endDate);
  const dates: string[] = [];

  for (
    let cursor = fromDateKey(startDate);
    cursor.getTime() <= end.getTime();
    cursor = addDays(cursor, 1)
  ) {
    const value =
      pattern.mode === 'weekly' ? cursor.getDay() : cursor.getDate();
    if (selectedValues.has(value)) dates.push(toDateKey(cursor));
  }

  return dates;
}
