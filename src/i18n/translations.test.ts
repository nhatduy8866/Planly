import { describe, expect, it } from '@jest/globals';

import { translate } from './translations';

describe('translations', () => {
  it('returns the selected Vietnamese and English copy', () => {
    expect(translate('vi', 'menu.appearance')).toBe('Giao diện');
    expect(translate('en', 'menu.appearance')).toBe('Appearance');
  });

  it('interpolates every supplied value', () => {
    expect(translate('en', 'ai.conflictAlert', {
      draft: 'Report',
      existing: 'Meeting',
    })).toBe('“Report” overlaps with “Meeting”');
  });

  it('formats task reminder lead time without duration metadata', () => {
    expect(translate('vi', 'task.reminderOnTime')).toBe('Nhắc đúng giờ');
    expect(translate('vi', 'task.reminderBefore', { count: 300 })).toBe(
      'Nhắc trước 300 phút',
    );
    expect(translate('vi', 'task.batchBadge')).toBe('Lặp');
  });
});
