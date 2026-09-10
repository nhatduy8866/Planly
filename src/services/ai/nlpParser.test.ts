import { describe, expect, it } from '@jest/globals';

import type { AiSchedulingContext } from '../../types/ai';
import { parseVietnameseScheduleText, refineVietnameseSchedule } from './nlpParser';

const context: AiSchedulingContext = {
  targetDate: '2026-09-07',
  currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
  existingTasks: [],
};

describe('nlpParser', () => {
  it.each([
    'tao lich 8h sang tap the duc va 14h hoc tieng anh',
    'tạo lịch 8h sáng tập thể dục và 14h học tiếng anh',
    'tao lich tap the duc 8h sang va hoc tieng anh 14h',
  ])('separates independently timed tasks: %s', (prompt) => {
    const drafts = parseVietnameseScheduleText(prompt, context);
    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.startTime)).toEqual(['08:00', '14:00']);
    expect(drafts[0].title).not.toContain('14h');
  });

  it.each([
    'tao lich 8h mua sach va but',
    'tao lich 8h doc sach va thoi luong 1h30p',
    'tao lich 8h doc sach va nhac truoc 30 phut',
  ])('keeps title and attribute conjunctions together: %s', (prompt) => {
    expect(parseVietnameseScheduleText(prompt, context)).toHaveLength(1);
  });

  it('removes the creation command from a new task title', () => {
    expect(parseVietnameseScheduleText('them viec mua sach luc 17h', context)[0].title)
      .toBe('Mua sach');
  });

  it('parses multi-task prompt from concept board accurately', () => {
    const prompt =
      'Mai 9h họp team, chiều 2h làm báo cáo, tối 8h học tiếng Trung. Nhắc trước 15 phút.';

    const drafts = parseVietnameseScheduleText(prompt, context);

    expect(drafts).toHaveLength(3);

    // Task 1: Họp team (09:00, reminder 15)
    expect(drafts[0].title).toContain('Họp team');
    expect(drafts[0].startTime).toBe('09:00');
    expect(drafts[0].reminderMinutes).toBe(15);
    expect(drafts[0].date).toBe('2026-09-08'); // ngày mai

    // Task 2: Làm báo cáo (14:00, reminder 15)
    expect(drafts[1].title).toContain('Báo cáo');
    expect(drafts[1].startTime).toBe('14:00');
    expect(drafts[1].reminderMinutes).toBe(15);
    expect(drafts[1].date).toBe('2026-09-08');

    // Task 3: Học tiếng Trung (20:00, reminder 15)
    expect(drafts[2].title).toContain('Học tiếng Trung');
    expect(drafts[2].startTime).toBe('20:00');
    expect(drafts[2].reminderMinutes).toBe(15);
    expect(drafts[2].date).toBe('2026-09-08');
  });

  it('handles follow-up refinement: reschedule a task', () => {
    const initial = parseVietnameseScheduleText(
      'Mai 9h họp team, chiều 2h làm báo cáo, tối 8h học tiếng Trung',
      context,
    );

    const refined = refineVietnameseSchedule(
      initial,
      'Dời báo cáo sang 10h nhé',
      context,
    );

    const reportTask = refined.find((t) => t.title.toLowerCase().includes('báo cáo'));
    expect(reportTask).toBeDefined();
    expect(reportTask?.startTime).toBe('10:00');
    expect(reportTask?.changeStatus).toBe('updated');
  });

  it('handles follow-up refinement: remove task', () => {
    const initial = parseVietnameseScheduleText(
      'Họp team 9h, Làm báo cáo 14h, Học tiếng Trung 20h',
      context,
    );

    const refined = refineVietnameseSchedule(
      initial,
      'Bỏ việc học tiếng Trung',
      context,
    );

    expect(refined).toHaveLength(2);
    expect(refined.some((t) => t.title.includes('Trung'))).toBe(false);
  });

  it('matches accented draft titles from an unaccented refinement', () => {
    const initial = parseVietnameseScheduleText(
      '9h làm báo cáo, 14h học tiếng Trung',
      context,
    );

    const moved = refineVietnameseSchedule(
      initial,
      'doi bao cao sang 11h',
      context,
    );
    const removed = refineVietnameseSchedule(
      moved,
      'bo viec hoc tieng trung',
      context,
    );

    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({
      startTime: '11:00',
      changeStatus: 'updated',
    });
  });

  it('correctly parses conversational appointment with reminder without splitting into two tasks', () => {
    const prompt = 'Tôi muốn tạo 1 cuộc hẹn đi chơi vào lúc 4h chiều nay, nhắc tôi trước 30p nhé';
    const drafts = parseVietnameseScheduleText(prompt, context);

    expect(drafts).toHaveLength(1);
    expect(drafts[0].title.toLowerCase()).toContain('đi chơi');
    expect(drafts[0].startTime).toBe('16:00');
    expect(drafts[0].reminderMinutes).toBe(30);
    expect(drafts[0].date).toBe('2026-09-07');
  });

  it('keeps unaccented task attributes attached to one task', () => {
    const prompt =
      'tao lich 2h toi da bong nhe, muc uu tien vua va thoi luong la 1h30p nhac dung hen nha';

    const drafts = parseVietnameseScheduleText(prompt, context);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      title: 'Da bong',
      startTime: '02:00',
      priority: 'medium',
      reminderMinutes: 0,
    });
  });

  it.each([
    ['nhac toi truoc 30p nhe', 30],
    ['bao dung gio nha', 0],
  ])('understands an unaccented reminder clause: "%s"', (reminder, expected) => {
    const drafts = parseVietnameseScheduleText(
      `tao lich 9h hop nhom, ${reminder}`,
      context,
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0].reminderMinutes).toBe(expected);
    expect(drafts[0].title).toBe('Hop nhom');
  });

  it('still separates an unaccented task whose action starts with "nhac"', () => {
    const drafts = parseVietnameseScheduleText(
      '9h hop nhom, 10h nhac me uong thuoc',
      context,
    );

    expect(drafts).toHaveLength(2);
    expect(drafts[1]).toMatchObject({
      startTime: '10:00',
      title: 'Nhac me uong thuoc',
    });
  });

  it('correctly schedules tasks by morning, afternoon, and evening periods', () => {
    const prompt =
      'tạo giúp tôi 1 lịch trình 3 việc, dọn nhà vào buổi sáng, chiều đi chơi, tối học bài';
    const drafts = parseVietnameseScheduleText(prompt, context);

    expect(drafts).toHaveLength(3);

    // Việc 1: Dọn nhà buổi sáng
    expect(drafts[0].title.toLowerCase()).toContain('dọn nhà');
    expect(drafts[0].startTime).toBe('08:30');

    // Việc 2: Đi chơi buổi chiều
    expect(drafts[1].title.toLowerCase()).toContain('đi chơi');
    expect(drafts[1].startTime).toBe('14:30');

    // Việc 3: Học bài buổi tối
    expect(drafts[2].title.toLowerCase()).toContain('học bài');
    expect(drafts[2].startTime).toBe('19:30');
  });

  it('reorders existing tasks on day without creating a dummy task', () => {
    const contextWithTasks: AiSchedulingContext = {
      realToday: '2026-09-07',
      targetDate: '2026-09-07',
      currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
      existingTasks: [
        {
          id: 'task-1',
          title: 'Dọn nhà buổi sáng',
          description: '',
          date: '2026-09-07',
          startTime: '08:00',
          reminderMinutes: 15,
          completed: false,
          order: 0,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'task-2',
          title: 'Học bài buổi tối',
          description: '',
          date: '2026-09-07',
          startTime: '19:00',
          reminderMinutes: 15,
          completed: false,
          order: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
    };

    const prompt = 'Sắp xếp lại các công việc trong ngày theo thứ tự ưu tiên và tránh trùng giờ.';
    const drafts = parseVietnameseScheduleText(prompt, contextWithTasks);

    expect(drafts).toHaveLength(2);
    // Preserves existing task IDs and titles
    expect(drafts[0].id).toBe('task-1');
    expect(drafts[0].title).toBe('Dọn nhà buổi sáng');
    expect(drafts[0].changeStatus).toBe('updated');
    expect(drafts[1].id).toBe('task-2');
    expect(drafts[1].title).toBe('Học bài buổi tối');
    expect(drafts[1].changeStatus).toBe('updated');
    // Does NOT create a dummy task named "Sắp xếp"
    expect(drafts.some((d) => d.title.toLowerCase().includes('sắp xếp'))).toBe(false);
  });

  it('returns empty array when asked to reorder an empty day', () => {
    const emptyContext: AiSchedulingContext = {
      realToday: '2026-09-07',
      targetDate: '2026-09-07',
      currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
      existingTasks: [],
    };

    const prompt = 'Sắp xếp lại các công việc trong ngày theo thứ tự ưu tiên và tránh trùng giờ.';
    const drafts = parseVietnameseScheduleText(prompt, emptyContext);

    expect(drafts).toEqual([]);
  });

  it('reorders the requested weekday by priority without reading "thứ tự" as a date', () => {
    const contextWithWeekTasks: AiSchedulingContext = {
      realToday: '2026-09-07',
      targetDate: '2026-09-07',
      currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
      existingTasks: [],
      allTasks: [
        {
          id: 'low-task',
          title: 'Đọc tin',
          description: '',
          date: '2026-09-09',
          startTime: '09:00',
          reminderMinutes: null,
          priority: 'low',
          completed: false,
          order: 0,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'high-task',
          title: 'Hoàn tất báo cáo',
          description: '',
          date: '2026-09-09',
          startTime: '16:00',
          reminderMinutes: 15,
          priority: 'high',
          completed: false,
          order: 1,
          createdAt: '',
          updatedAt: '',
        },
      ],
    };

    const drafts = parseVietnameseScheduleText(
      'Thứ Tư, giúp tôi sắp xếp lại lịch theo thứ tự ưu tiên',
      contextWithWeekTasks,
    );

    expect(drafts.map((draft) => draft.id)).toEqual([
      'high-task',
      'low-task',
    ]);
    expect(drafts.every((draft) => draft.date === '2026-09-09')).toBe(true);
    expect(drafts[0].startTime).toBe('08:00');
  });

  it('does not treat arranging one document as a whole-day reorder', () => {
    const drafts = parseVietnameseScheduleText(
      'Sắp xếp tài liệu thứ Tư lúc 9h',
      context,
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0].date).toBe('2026-09-09');
    expect(drafts[0].startTime).toBe('09:00');
  });

  it('carries an explicit date forward until another segment changes it', () => {
    const drafts = parseVietnameseScheduleText(
      'Ngày mai họp lúc 9h, làm báo cáo lúc 11h; thứ Sáu đi gym lúc 18h, đọc sách lúc 20h',
      context,
    );

    expect(drafts.map((draft) => draft.date)).toEqual([
      '2026-09-08',
      '2026-09-08',
      '2026-09-11',
      '2026-09-11',
    ]);
  });
});
