import { describe, expect, it } from '@jest/globals';

import type { AiSchedulingContext } from '../../types/ai';
import {
  AiBatchScheduleError,
  parseAiBatchSchedule,
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
    ).toEqual({
      mode: 'weekly',
      dates: [
        '2026-09-07',
        '2026-09-09',
        '2026-09-14',
        '2026-09-16',
      ],
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
});
