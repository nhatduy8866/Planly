import type { AiSchedulingContext } from '../../types/ai';
import { addDays, fromDateKey, startOfWeek, toDateKey } from '../../utils/date';

export interface ScheduleDateResolution {
  date: string;
  hasExplicitDate: boolean;
}

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = fromDateKey(value);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

function dateKeyFromParts(
  year: number,
  month: number,
  day: number,
): string | null {
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return toDateKey(candidate);
}

function resolveAbsoluteDate(text: string, anchorDate: Date): string | null {
  const isoMatch = text.match(/(?:^|\D)(\d{4}-\d{2}-\d{2})(?=$|\D)/);
  if (isoMatch && isValidDateKey(isoMatch[1])) return isoMatch[1];

  const numericMatch = text.match(
    /(?:^|\s)(?:ngày\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?(?=$|[\s,.!?])/i,
  );
  const wordsMatch = text.match(
    /(?:^|\s)ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?(?=$|[\s,.!?])/i,
  );
  const match = numericMatch || wordsMatch;
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const explicitYear = match[3] ? Number(match[3]) : null;
  let year = explicitYear ?? anchorDate.getFullYear();
  let dateKey = dateKeyFromParts(year, month, day);

  if (
    dateKey &&
    explicitYear === null &&
    fromDateKey(dateKey).getTime() < anchorDate.getTime()
  ) {
    year += 1;
    dateKey = dateKeyFromParts(year, month, day);
  }

  return dateKey;
}

const WEEKDAY_BY_NAME: Record<string, number> = {
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

function resolveWeekday(text: string, anchorDate: Date): string | null {
  const normalized = normalizeVietnamese(text).replace(/\s+/g, ' ').trim();
  const normalizedSpacing = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const match = normalizedSpacing.match(
    /(?:^|\s)(thứ\s*(?:[2-7]|hai|ba|tư|năm|sáu|bảy)|chủ\s*nhật|thu\s*[2-7])(?=$|[\s,.!?])/,
  );
  if (!match) return null;

  const weekdayName = normalizeVietnamese(match[1]).replace(/\s+/g, ' ');
  const targetWeekday = WEEKDAY_BY_NAME[weekdayName];
  if (targetWeekday === undefined) return null;

  if (/\btuan sau\b/.test(normalized)) {
    const nextMonday = addDays(startOfWeek(anchorDate), 7);
    const mondayIndex = targetWeekday === 0 ? 6 : targetWeekday - 1;
    return toDateKey(addDays(nextMonday, mondayIndex));
  }

  if (/\btuan nay\b/.test(normalized)) {
    const monday = startOfWeek(anchorDate);
    const mondayIndex = targetWeekday === 0 ? 6 : targetWeekday - 1;
    return toDateKey(addDays(monday, mondayIndex));
  }

  let offset = targetWeekday - anchorDate.getDay();
  if (offset <= 0) offset += 7;
  return toDateKey(addDays(anchorDate, offset));
}

/** Resolves every supported date expression from the same real-today anchor. */
export function resolveScheduleDate(
  text: string,
  context: Pick<AiSchedulingContext, 'realToday' | 'targetDate'>,
): ScheduleDateResolution {
  const anchorKey = isValidDateKey(context.realToday)
    ? context.realToday
    : context.targetDate;
  const anchorDate = fromDateKey(anchorKey);
  const normalized = normalizeVietnamese(text);

  const absoluteDate = resolveAbsoluteDate(text, anchorDate);
  if (absoluteDate) return { date: absoluteDate, hasExplicitDate: true };

  if (
    /(?:^|\s)(?:ngay kia|ngay mot)(?=$|[\s,.!?])/.test(normalized) ||
    /(?:^|\s)mốt(?=$|[\s,.!?])/i.test(text)
  ) {
    return {
      date: toDateKey(addDays(anchorDate, 2)),
      hasExplicitDate: true,
    };
  }
  if (/(?:^|\s)(?:ngay mai|mai)(?=$|[\s,.!?])/.test(normalized)) {
    return {
      date: toDateKey(addDays(anchorDate, 1)),
      hasExplicitDate: true,
    };
  }
  if (/(?:^|\s)hom nay(?=$|[\s,.!?])/.test(normalized)) {
    return { date: anchorKey, hasExplicitDate: true };
  }

  const weekdayDate = resolveWeekday(text, anchorDate);
  if (weekdayDate) return { date: weekdayDate, hasExplicitDate: true };

  return { date: context.targetDate, hasExplicitDate: false };
}

export function stripScheduleDateReferences(text: string): string {
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/(?:^|\s)(?:ngày\s+)?\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?(?=$|[\s,.!?])/gi, ' ')
    .replace(/(?:^|\s)ngày\s+\d{1,2}\s+tháng\s+\d{1,2}(?:\s+năm\s+\d{4})?(?=$|[\s,.!?])/gi, ' ')
    .replace(/(?:^|\s)(?:hôm nay|ngày mai|mai|ngày kia|ngày mốt)(?=$|[\s,.!?])/gi, ' ')
    .replace(/(?:^|\s)(?:thứ\s*(?:[2-7]|hai|ba|tư|năm|sáu|bảy)|chủ\s*nhật)(?:\s+tuần\s+(?:này|sau))?(?=$|[\s,.!?])/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
