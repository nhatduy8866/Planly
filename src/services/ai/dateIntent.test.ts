import { describe, expect, it } from '@jest/globals';

import { resolveScheduleDate } from './dateIntent';

const context = {
  realToday: '2026-09-07', // Thứ Hai
  targetDate: '2026-09-10',
};

describe('resolveScheduleDate', () => {
  it.each([
    ['hôm nay', '2026-09-07'],
    ['mai', '2026-09-08'],
    ['ngày kia', '2026-09-09'],
    ['thứ Tư', '2026-09-09'],
    ['thứ 2', '2026-09-14'],
    ['thứ Sáu tuần sau', '2026-09-18'],
    ['ngày 20/09/2026', '2026-09-20'],
    ['ngày 5 tháng 10 năm 2026', '2026-10-05'],
  ])('resolves "%s" from realToday', (input, expectedDate) => {
    expect(resolveScheduleDate(input, context)).toEqual({
      date: expectedDate,
      hasExplicitDate: true,
    });
  });

  it('uses the viewed date when the prompt has no date reference', () => {
    expect(resolveScheduleDate('Họp nhóm lúc 9h', context)).toEqual({
      date: '2026-09-10',
      hasExplicitDate: false,
    });
  });

  it('resolves an unaccented weekday name', () => {
    expect(resolveScheduleDate('thu tu toi da bong', context)).toEqual({
      date: '2026-09-09',
      hasExplicitDate: true,
    });
  });

  it('does not mistake "thứ tự" for Wednesday', () => {
    expect(
      resolveScheduleDate('Sắp xếp lịch theo thứ tự ưu tiên', context),
    ).toEqual({
      date: '2026-09-10',
      hasExplicitDate: false,
    });
  });

  it('ignores invalid absolute dates instead of rolling them over', () => {
    expect(resolveScheduleDate('Lên lịch ngày 31/02/2026', context)).toEqual({
      date: '2026-09-10',
      hasExplicitDate: false,
    });
  });
});
