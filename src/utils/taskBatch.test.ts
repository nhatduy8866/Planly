import { describe, expect, it } from '@jest/globals';

import {
  addCalendarMonths,
  buildTaskBatchDates,
  buildTaskRecurrenceDates,
  getTaskBatchRangeIssue,
} from './taskBatch';

describe('task batch date utilities', () => {
  it('creates tasks on selected weekdays inside the inclusive range', () => {
    expect(
      buildTaskBatchDates('2026-09-07', '2026-09-20', {
        mode: 'weekly',
        weekdays: [1, 3],
      }),
    ).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-14',
      '2026-09-16',
    ]);
  });

  it('creates tasks on selected month days and skips missing dates', () => {
    expect(
      buildTaskBatchDates('2026-01-30', '2026-03-31', {
        mode: 'monthly',
        monthDays: [15, 31],
      }),
    ).toEqual(['2026-01-31', '2026-02-15', '2026-03-15', '2026-03-31']);
  });

  it('adds calendar months while clamping to the last valid day', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarMonths('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('rejects reversed ranges and ranges longer than one year', () => {
    expect(getTaskBatchRangeIssue('2026-09-10', '2026-09-09')).toBe(
      'end_before_start',
    );
    expect(getTaskBatchRangeIssue('2026-01-01', '2027-01-02')).toBe(
      'range_too_long',
    );
  });

  it('supports daily intervals, count limits, and excluded dates', () => {
    expect(buildTaskRecurrenceDates({
      frequency: 'daily',
      interval: 2,
      startDate: '2026-09-07',
      endDate: '2026-09-30',
      count: 4,
      excludedDates: ['2026-09-11'],
    })).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-13',
      '2026-09-15',
    ]);
  });

  it('supports weekly intervals anchored to the start week', () => {
    expect(buildTaskRecurrenceDates({
      frequency: 'weekly',
      interval: 2,
      startDate: '2026-09-07',
      endDate: '2026-10-04',
      weekdays: [1, 4],
    })).toEqual([
      '2026-09-07',
      '2026-09-10',
      '2026-09-21',
      '2026-09-24',
    ]);
  });

  it('supports first and last weekdays of each month', () => {
    expect(buildTaskRecurrenceDates({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      monthlyWeekday: { weekday: 1, ordinal: 1 },
    })).toEqual(['2026-09-07', '2026-10-05', '2026-11-02']);

    expect(buildTaskRecurrenceDates({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      monthlyWeekday: { weekday: 5, ordinal: -1 },
    })).toEqual(['2026-09-25', '2026-10-30', '2026-11-27']);
  });

  it('supports end-relative month days and skips impossible dates', () => {
    expect(buildTaskRecurrenceDates({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      monthDays: [-1, 31],
    })).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });
});
