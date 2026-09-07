import { describe, expect, it } from '@jest/globals';

import { isReorderIntent } from './scheduleIntent';

describe('isReorderIntent', () => {
  it.each([
    'Sắp xếp lại các công việc trong ngày',
    'Ngày mai giúp tôi tối ưu lịch trình',
    'Thứ Tư, xếp lại lịch theo thứ tự ưu tiên',
    'Sắp xếp lại theo thứ tự ưu tiên',
    'tai sap xep ke hoach',
  ])('recognizes whole-schedule reorder: "%s"', (prompt) => {
    expect(isReorderIntent(prompt)).toBe(true);
  });

  it.each([
    'Sắp xếp tài liệu thứ Tư lúc 9h',
    'Cho tôi xem lịch sắp tới',
    'Dời cuộc họp sang 10h',
  ])('does not classify a normal task request as reorder: "%s"', (prompt) => {
    expect(isReorderIntent(prompt)).toBe(false);
  });
});
