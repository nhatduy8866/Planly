import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  formatLongDate,
  fromDateKey,
  getMonthGrid,
  getWeekDays,
  startOfWeek,
  timeToMinutes,
  toDateKey,
} from './date';

describe('date utilities', () => {
  it('round-trips a local date key without shifting timezone', () => {
    const date = new Date(2026, 8, 5);
    expect(toDateKey(date)).toBe('2026-09-05');
    expect(fromDateKey('2026-09-05').getDate()).toBe(5);
  });

  it('starts a week on Monday, including when given Sunday', () => {
    const sunday = new Date(2026, 8, 6);
    expect(toDateKey(startOfWeek(sunday))).toBe('2026-08-31');
    expect(getWeekDays(sunday)).toHaveLength(7);
  });

  it('builds a stable six-week month grid', () => {
    const grid = getMonthGrid(new Date(2026, 8, 1));
    expect(grid).toHaveLength(42);
    expect(toDateKey(grid[0])).toBe('2026-08-31');
    expect(toDateKey(grid[41])).toBe('2026-10-11');
  });

  it('adds days and converts time to minutes', () => {
    expect(toDateKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(timeToMinutes('13:45')).toBe(825);
  });

  it('formats dates for both supported languages', () => {
    expect(formatLongDate('2026-09-07', 'en-US')).toContain('September');
    expect(formatLongDate('2026-09-07', 'vi-VN')).toContain('tháng 9');
  });

  it('formats date ranges clearly without ambiguity', () => {
    const { formatDateRange } = require('./date');
    expect(formatDateRange('2026-09-14', '2027-09-07')).toBe('14/09/2026 – 07/09/2027');
    expect(formatDateRange('2026-09-10', '2026-09-20')).toBe('10/09/2026 – 20/09/2026');
    expect(formatDateRange('2026-09-14', '2026-09-14')).toBe('14/09/2026');
  });
});
