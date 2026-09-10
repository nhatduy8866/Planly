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

  it('does not read the unaccented pronoun in "2h toi da bong" as evening', () => {
    expect(parseVietnameseTime('2h toi da bong')).toEqual({
      startTime: '02:00',
      matchedText: '2h',
    });
  });

  it.each([
    ['2h chieu', '14:00'],
    ['buoi toi 8h', '20:00'],
    ['8h buoi toi', '20:00'],
  ])('recognizes an unaccented time period in "%s"', (input, expected) => {
    expect(parseVietnameseTime(input)?.startTime).toBe(expected);
  });

  it('rejects invalid clock values', () => {
    expect(parseVietnameseTime('lúc 25h99')).toBeNull();
  });
});
