import { describe, expect, it } from '@jest/globals';

import type { AiSchedulingContext } from '../../types/ai';
import {
  AiBatchScheduleError,
  parseAiBatchSchedule,
  parseAiRecurrenceRule,
  stripAiBatchScheduleReferences,
} from './batchIntent';

const context: AiSchedulingContext = {
  realToday: '2026-09-07',
  realTodayDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
  targetDate: '2026-09-07',
  currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
  existingTasks: [],
};

describe('AI batch intent', () => {
  it('builds an inclusive weekly batch from unaccented weekdays', () => {
    expect(
      parseAiBatchSchedule(
        'tap gym moi thu 2, thu 4 den ngay 20/09/2026',
        context,
      ),
    ).toMatchObject({
      mode: 'weekly',
      dates: [
        '2026-09-07',
        '2026-09-09',
        '2026-09-14',
        '2026-09-16',
      ],
      rule: {
        frequency: 'weekly',
        weekdays: [1, 3],
      },
    });
  });

  it('builds a monthly batch and skips dates missing from a month', () => {
    expect(
      parseAiBatchSchedule(
        'Đóng tiền vào ngày 31 hàng tháng từ ngày 30/09/2026 đến ngày 31/12/2026',
        context,
      )?.dates,
    ).toEqual(['2026-10-31', '2026-12-31']);
  });

  it('removes recurrence details without damaging the task title', () => {
    expect(
      stripAiBatchScheduleReferences(
        'Tập gym mỗi thứ 2, thứ 4 đến ngày 20/09/2026',
      ),
    ).toBe('Tập gym');
    expect(
      stripAiBatchScheduleReferences(
        'Tập gym mỗi thứ hai và thứ tư đến ngày 20/09/2026',
      ),
    ).toBe('Tập gym');
  });

  it('rejects a recurring range longer than the manual one-year limit', () => {
    expect(() =>
      parseAiBatchSchedule(
        'tap gym hang tuan tu ngay 07/09/2026 den ngay 08/09/2027',
        context,
      ),
    ).toThrow(AiBatchScheduleError);
  });

  it('understands a daily routine from a day period, with or without accents', () => {
    for (const prompt of ['mỗi sáng đi bộ 6h sáng', 'MOI SANG DI BO 6H SANG']) {
      expect(parseAiRecurrenceRule(prompt, context)).toMatchObject({
        frequency: 'daily',
        interval: 1,
        startDate: '2026-09-07',
      });
    }
  });

  it('prefers explicit weekdays over loose monthly wording', () => {
    expect(parseAiRecurrenceRule(
      'MỖI SÁNG THỨ 2 VÀ THỨ 5 HÀNG THÁNG VÀO LÚC 5H SẼ HỌC YOGA',
      context,
    )).toMatchObject({
      frequency: 'weekly',
      weekdays: [1, 4],
    });
  });

  it('distinguishes month days from an ordinal weekday', () => {
    expect(parseAiRecurrenceRule(
      'thanh toán vào ngày 2 và ngày 5 hàng tháng',
      context,
    )).toMatchObject({
      frequency: 'monthly',
      monthDays: [2, 5],
    });
    expect(parseAiRecurrenceRule(
      'họp vào thứ Hai đầu mỗi tháng',
      context,
    )).toMatchObject({
      frequency: 'monthly',
      monthlyWeekday: { weekday: 1, ordinal: 1 },
    });
  });
});
