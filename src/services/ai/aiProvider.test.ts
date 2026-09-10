import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Task } from '../../types';
import type { AiSchedulingContext } from '../../types/ai';
import { PlanlyAiProvider } from './aiProvider';

const context: AiSchedulingContext = {
  realToday: '2026-09-07',
  realTodayDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
  targetDate: '2026-09-07',
  currentDayName: 'Thứ Hai, 7 tháng 9 năm 2026',
  existingTasks: [],
};

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Việc hiện có',
    description: '',
    date: '2026-09-09',
    startTime: '10:00',
    reminderMinutes: 15,
    priority: 'medium',
    completed: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('PlanlyAiProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses deterministic local reorder and preserves task IDs even with an API key', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;
    const provider = new PlanlyAiProvider('test-key');
    const task = makeTask({});

    const result = await provider.parseScheduleRequest(
      'Sắp xếp lại lịch thứ Tư theo thứ tự ưu tiên',
      { ...context, allTasks: [task] },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(task.id);
    expect(result[0].date).toBe('2026-09-09');
  });

  it('updates an existing task locally instead of asking Gemini to create another one', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;
    const footballTask = makeTask({
      id: 'football-task',
      title: 'Lịch đá bóng',
      date: '2026-09-07',
      startTime: '02:00',
    });

    const result = await new PlanlyAiProvider(
      'test-key',
    ).parseScheduleRequest('Chỉnh lịch đá bóng lại thành 14h', {
      ...context,
      existingTasks: [footballTask],
      allTasks: [footballTask],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('football-task');
    expect(result[0].startTime).toBe('14:00');
  });

  it('normalizes an invalid cloud date to the resolved prompt date', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      id: 'cloud-task',
                      title: 'Họp khách hàng',
                      date: '2026-02-31',
                      startTime: '09:00',
                    },
                  ]),
                },
              ],
            },
          },
        ],
      }),
    } as Response);
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider(
      'test-key',
    ).parseScheduleRequest('Ngày mai họp khách hàng lúc 9h', context);

    expect(result[0].date).toBe('2026-09-08');
  });

  it('drops a cloud item that contains only unaccented task attributes', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      title: 'Da bong',
                      date: '2026-09-07',
                      startTime: '02:00',
                      reminderMinutes: 0,
                      priority: 'medium',
                    },
                    {
                      title: 'Muc uu tien vua va thoi luong 1h30p',
                      date: '2026-09-07',
                      startTime: '01:30',
                      reminderMinutes: 15,
                      priority: 'none',
                    },
                  ]),
                },
              ],
            },
          },
        ],
      }),
    } as Response);
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'tao lich 2h toi da bong, muc uu tien vua va thoi luong 1h30p nhac dung hen',
      context,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Da bong',
      startTime: '02:00',
      reminderMinutes: 0,
      priority: 'medium',
    });
  });

  it('falls back to the offline parser when both cloud models fail', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network unavailable'));
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider(
      'test-key',
    ).parseScheduleRequest('Ngày mai họp nhóm lúc 9h', context);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-09-08');
    expect(result[0].startTime).toBe('09:00');
  });

  it('sanitizes invalid task fields returned by the cloud model', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      id: 'bad-cloud-task',
                      title: 'Dữ liệu sai',
                      date: '2026-09-07',
                      startTime: '25:99',
                      reminderMinutes: 999,
                      priority: 'urgent',
                      source: 'unknown',
                      changeStatus: 'broken',
                    },
                  ]),
                },
              ],
            },
          },
        ],
      }),
    } as Response);
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider(
      'test-key',
    ).parseScheduleRequest('Lên lịch một việc', context);

    expect(result[0]).toMatchObject({
      id: 'bad-cloud-task',
      startTime: '',
      reminderMinutes: 15,
      priority: 'none',
      source: 'direct_request',
      changeStatus: 'unchanged',
    });
  });

  it('sanitizes refinement output and preserves a matched draft ID', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      id: 'hallucinated-id',
                      title: 'Việc hiện có',
                      date: 'not-a-date',
                      startTime: '9:05',
                      reminderMinutes: null,
                      priority: 'high',
                    },
                  ]),
                },
              ],
            },
          },
        ],
      }),
    } as Response);
    global.fetch = fetchMock;
    const currentDraft = {
      id: 'original-id',
      title: 'Việc hiện có',
      date: '2026-09-09',
      startTime: '10:00',
      reminderMinutes: 15 as const,
      priority: 'medium' as const,
      source: 'direct_request' as const,
    };

    const result = await new PlanlyAiProvider('test-key').refineSchedule(
      [currentDraft],
      'Đổi giờ',
      context,
    );

    expect(result[0]).toMatchObject({
      id: 'original-id',
      date: '2026-09-09',
      startTime: '09:05',
      reminderMinutes: null,
      priority: 'high',
      changeStatus: 'updated',
    });
  });
});
