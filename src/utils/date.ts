const VIETNAMESE_WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
type SupportedLocale = 'vi-VN' | 'en-US';

const weekdayFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>();
const monthTitleFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>();
const longDateFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>();
const compactDateFormatters = new Map<SupportedLocale, Intl.DateTimeFormat>();

function cachedFormatter(
  cache: Map<SupportedLocale, Intl.DateTimeFormat>,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cached = cache.get(locale);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, options);
  cache.set(locale, formatter);
  return formatter;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = result.getDay() === 0 ? -6 : 1 - result.getDay();
  return addDays(result, mondayOffset);
}

export function getWeekDays(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function getMonthGrid(date: Date): Date[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function getWeekdayShort(
  date: Date,
  locale: SupportedLocale = 'vi-VN',
): string {
  if (locale === 'vi-VN') return VIETNAMESE_WEEKDAYS_SHORT[date.getDay()];
  return cachedFormatter(weekdayFormatters, locale, {
    weekday: 'short',
  }).format(date).slice(0, 2);
}

export function formatMonthTitle(
  date: Date,
  locale: SupportedLocale = 'vi-VN',
): string {
  const text = cachedFormatter(monthTitleFormatters, locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatLongDate(
  dateKey: string,
  locale: SupportedLocale = 'vi-VN',
): string {
  const text = cachedFormatter(longDateFormatters, locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromDateKey(dateKey));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatCompactDate(
  dateKey: string,
  locale: SupportedLocale = 'vi-VN',
): string {
  return cachedFormatter(compactDateFormatters, locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(fromDateKey(dateKey));
}

export function taskDateTime(dateKey: string, time: string): Date {
  const date = fromDateKey(dateKey);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
