import { describe, expect, it } from '@jest/globals';

import { findScheduleClarification } from './scheduleClarification';

describe('findScheduleClarification', () => {
  it('asks for clarification when "toi" after an hour has no accents', () => {
    expect(findScheduleClarification('tao lich 2h toi da bong')?.hour).toBe(2);
  });

  it.each([
    'tạo lịch 2h tôi đá bóng',
    'tạo lịch 2h tối đá bóng',
    'tao lich 2h buoi toi da bong',
    'tao lich 14h da bong',
  ])('does not flag the explicit phrase "%s"', (prompt) => {
    expect(findScheduleClarification(prompt)).toBeNull();
  });
});
