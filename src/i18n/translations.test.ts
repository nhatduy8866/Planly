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
    })).toBe('“Report” starts at the same time as “Meeting”');
  });

  it('formats task reminder lead time', () => {
    expect(translate('vi', 'task.reminderOnTime')).toBe('Nhắc đúng giờ');
    expect(translate('vi', 'task.reminderBefore', { count: 300 })).toBe(
      'Nhắc trước 300 phút',
    );
    expect(translate('vi', 'task.batchBadge')).toBe('Lặp');
  });

  it('formats task time conflict details', () => {
    expect(
      translate('vi', 'taskForm.timeConflict', {
        date: '09/09/2026',
        time: '09:00',
        title: 'Họp nhóm',
      }),
    ).toBe(
      'Lúc 09:00 ngày 09/09/2026 đã có công việc “Họp nhóm”. Hãy chọn giờ bắt đầu khác.',
    );
  });
});
