import { describe, expect, it } from '@jest/globals';

import type { Task } from '../../types';
import type { AiSchedulingContext } from '../../types/ai';
import {
  isTaskUpdateIntent,
  resolveExistingTaskUpdate,
} from './taskUpdateIntent';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'football-task',
    title: 'Lịch đá bóng',
    description: '',
    date: '2026-09-07',
    startTime: '02:00',
    durationMinutes: 90,
    reminderMinutes: 15,
    priority: 'medium',
    completed: false,
    order: 1,
    createdAt: '2026-09-07T01:00:00.000Z',
    updatedAt: '2026-09-07T01:00:00.000Z',
    ...overrides,
  };
}

function makeContext(tasks: Task[]): AiSchedulingContext {
  return {
    realToday: '2026-09-07',
    targetDate: '2026-09-07',
    currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
    existingTasks: tasks,
    allTasks: tasks,
  };
}

describe('taskUpdateIntent', () => {
  it('updates the matching task time while preserving its ID and fields', () => {
    const footballTask = makeTask();
    const result = resolveExistingTaskUpdate(
      'Chỉnh lịch đá bóng lại thành 14h',
      makeContext([
        footballTask,
        makeTask({ id: 'report-task', title: 'Làm báo cáo' }),
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      id: 'football-task',
      title: 'Lịch đá bóng',
      startTime: '14:00',
      durationMinutes: 90,
      reminderMinutes: 15,
      priority: 'medium',
      changeStatus: 'updated',
    });
  });

  it('matches meaningful title tokens despite filler words in stored titles', () => {
    const result = resolveExistingTaskUpdate(
      'Đổi giờ lịch đá bóng sang 14h',
      makeContext([
        makeTask({ title: 'Tôi lịch đá bóng nữa nhé' }),
        makeTask({ id: 'study-task', title: 'Lịch học bài' }),
      ]),
    );

    expect(result?.[0].id).toBe('football-task');
    expect(result?.[0].startTime).toBe('14:00');
  });

  it('moves the matched task date without changing unrelated fields', () => {
    const result = resolveExistingTaskUpdate(
      'Chuyển lịch đá bóng sang ngày mai lúc 16h',
      makeContext([makeTask()]),
    );

    expect(result?.[0]).toMatchObject({
      id: 'football-task',
      date: '2026-09-08',
      startTime: '16:00',
      durationMinutes: 90,
    });
  });

  it('returns an empty update instead of creating a duplicate when no task matches', () => {
    expect(
      resolveExistingTaskUpdate(
        'Chỉnh lịch đi bơi thành 14h',
        makeContext([makeTask()]),
      ),
    ).toEqual([]);
  });

  it('does not classify a normal creation request as an update', () => {
    expect(isTaskUpdateIntent('Sửa xe lúc 14h')).toBe(false);
    expect(
      resolveExistingTaskUpdate('Sửa xe lúc 14h', makeContext([])),
    ).toBeNull();
  });

  it('supports update commands typed without Vietnamese accents', () => {
    const result = resolveExistingTaskUpdate(
      'chinh lich da bong lai thanh 14h',
      makeContext([makeTask()]),
    );

    expect(result?.[0].id).toBe('football-task');
    expect(result?.[0].startTime).toBe('14:00');
  });
});
