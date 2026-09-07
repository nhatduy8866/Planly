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
    durationMinutes: 60,
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
                      durationMinutes: 60,
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
});
