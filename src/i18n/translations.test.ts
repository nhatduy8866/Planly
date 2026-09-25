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

  it('formats the repeating-task badge', () => {
    expect(translate('vi', 'task.batchBadge')).toBe('Lặp');
  });

  it('includes privacy and sync feedback copy in both languages', () => {
    expect(translate('vi', 'privacy.title')).toBe('Chính sách quyền riêng tư');
    expect(translate('en', 'toast.syncCompleted')).toBe(
      'Data synced successfully',
    );
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
