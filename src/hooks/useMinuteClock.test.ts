import { describe, expect, it } from '@jest/globals';

import { getClockRefreshDelay } from './useMinuteClock';

describe('getClockRefreshDelay', () => {
  it('refreshes at the next minute for time-sensitive filters', () => {
    const now = new Date(2026, 8, 10, 10, 15, 30, 250);

    expect(getClockRefreshDelay(now, true)).toBe(29_750);
  });

  it('refreshes at the next local midnight for stable filters', () => {
    const now = new Date(2026, 8, 10, 23, 59, 30, 0);

    expect(getClockRefreshDelay(now, false)).toBe(30_000);
  });
});
