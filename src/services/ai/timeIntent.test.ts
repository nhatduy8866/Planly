import { describe, expect, it } from '@jest/globals';

import { parseVietnameseTime } from './timeIntent';

describe('parseVietnameseTime', () => {
  it.each([
    ['14h', '14:00'],
    ['2h chiều', '14:00'],
    ['chiều 2h30', '14:30'],
    ['lúc 9:05 sáng', '09:05'],
    ['12h sáng', '00:00'],
  ])('normalizes "%s" to %s', (input, expected) => {
    expect(parseVietnameseTime(input)?.startTime).toBe(expected);
  });

  it('uses the last time in an update command', () => {
    expect(
      parseVietnameseTime('Đổi từ 2h sang 14h', true)?.startTime,
    ).toBe('14:00');
  });

  it('rejects invalid clock values', () => {
    expect(parseVietnameseTime('lúc 25h99')).toBeNull();
  });
});
