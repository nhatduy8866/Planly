import { describe, expect, it } from '@jest/globals';

import type { AiSchedulingContext } from '../../types/ai';
import { parseVietnameseScheduleText, refineVietnameseSchedule } from './nlpParser';

const context: AiSchedulingContext = {
  targetDate: '2026-09-07',
  currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
  existingTasks: [],
};

describe('nlpParser', () => {
  it('parses multi-task prompt from concept board accurately', () => {
    const prompt =
      'Mai 9h họp team 1 tiếng, chiều 2h làm báo cáo 90 phút, tối 8h học tiếng Trung. Nhắc trước 15 phút.';

    const drafts = parseVietnameseScheduleText(prompt, context);

    expect(drafts).toHaveLength(3);

    // Task 1: Họp team (09:00, 60m, reminder 15)
    expect(drafts[0].title).toContain('Họp team');
    expect(drafts[0].startTime).toBe('09:00');
    expect(drafts[0].durationMinutes).toBe(60);
    expect(drafts[0].reminderMinutes).toBe(15);
    expect(drafts[0].date).toBe('2026-09-08'); // ngày mai

    // Task 2: Làm báo cáo (14:00, 90m, reminder 15)
    expect(drafts[1].title).toContain('Báo cáo');
    expect(drafts[1].startTime).toBe('14:00');
    expect(drafts[1].durationMinutes).toBe(90);
    expect(drafts[1].reminderMinutes).toBe(15);

    // Task 3: Học tiếng Trung (20:00, reminder 15)
    expect(drafts[2].title).toContain('Học tiếng Trung');
    expect(drafts[2].startTime).toBe('20:00');
    expect(drafts[2].reminderMinutes).toBe(15);
  });

  it('handles follow-up refinement: reschedule and change duration', () => {
    const initial = parseVietnameseScheduleText(
      'Mai 9h họp team 1 tiếng, chiều 2h làm báo cáo 90 phút, tối 8h học tiếng Trung',
      context,
    );

    // Refinement command: "Dời báo cáo sang 10h và thành 2 tiếng nhé"
    const refined = refineVietnameseSchedule(
      initial,
      'Dời báo cáo sang 10h và thành 2 tiếng nhé',
      context,
    );

    const reportTask = refined.find((t) => t.title.toLowerCase().includes('báo cáo'));
    expect(reportTask).toBeDefined();
    expect(reportTask?.startTime).toBe('10:00');
    expect(reportTask?.durationMinutes).toBe(120);
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

  it('correctly parses conversational appointment with reminder without splitting into two tasks', () => {
    const prompt = 'Tôi muốn tạo 1 cuộc hẹn đi chơi vào lúc 4h chiều nay, nhắc tôi trước 30p nhé';
    const drafts = parseVietnameseScheduleText(prompt, context);

    expect(drafts).toHaveLength(1);
    expect(drafts[0].title.toLowerCase()).toContain('đi chơi');
    expect(drafts[0].startTime).toBe('16:00');
    expect(drafts[0].reminderMinutes).toBe(30);
    expect(drafts[0].date).toBe('2026-09-07');
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
          durationMinutes: 60,
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
          durationMinutes: 60,
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
});
