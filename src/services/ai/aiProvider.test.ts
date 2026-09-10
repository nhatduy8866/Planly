import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Task } from '../../types';
import type { AiSchedulingContext } from '../../types/ai';
import { PlanlyAiProvider } from './aiProvider';
import { AiScheduleClarificationError } from './scheduleClarification';

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
  it.each(['Mua sách', 'Them viec mua sach'])(
    'updates an existing %s at 20:00 without creating a task', async (title) => {
      const task = makeTask({ id: 'book-task', title, date: context.targetDate });
      const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
        'cap nhat viec mua sach vao luc 8h toi',
        { ...context, existingTasks: [task] },
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: task.id, title, startTime: '20:00', changeStatus: 'updated' });
    },
  );

  it('does not create a task for an update with no matching target', async () => {
    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'cap nhat viec mua sach vao luc 8h toi', context,
    );
    expect(result).toEqual([]);
  });

  it('repairs a cloud result that merges two independently timed tasks', async () => {
    const response = (items: object[]) => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }] }),
    } as Response);
    const first = { id: 'exercise', title: 'Tập thể dục', date: context.targetDate, startTime: '08:00', reminderMinutes: 15, priority: 'none' };
    const second = { ...first, id: 'study', title: 'Học tiếng Anh', startTime: '14:00' };
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response([{ ...first, title: 'Tap the duc va 14h hoc tieng anh' }]))
      .mockResolvedValueOnce(response([first, second]));
    global.fetch = fetchMock;
    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'tao lich 8h sang tap the duc va 14h hoc tieng anh', context,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.map((task) => task.startTime)).toEqual(['08:00', '14:00']);
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('task_count_mismatch');
  });

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

  it('asks Gemini to repair an attribute-only task before accepting the result', async () => {
    const invalidResponse = {
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
    } as Response;
    const repairedResponse = {
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
                  ]),
                },
              ],
            },
          },
        ],
      }),
    } as Response;
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(invalidResponse)
      .mockResolvedValueOnce(repairedResponse);
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'tao lich 2h da bong, muc uu tien vua va thoi luong 1h30p nhac dung hen',
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    ) as { contents: { parts: { text: string }[] }[] };
    expect(repairRequest.contents[0].parts[0].text).toContain(
      'attribute_only_task',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Da bong',
      startTime: '02:00',
      reminderMinutes: 0,
      priority: 'medium',
    });
  });

  it('uses a structured response schema for Gemini scheduling', async () => {
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
                      id: '',
                      title: 'Họp nhóm',
                      date: '2026-09-07',
                      startTime: '09:00',
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

    await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'Họp nhóm lúc 9h',
      context,
    );

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      generationConfig: {
        responseJsonSchema?: {
          type?: string;
          items?: { properties?: Record<string, unknown> };
        };
        responseSchema?: unknown;
      };
    };
    expect(request.generationConfig.responseJsonSchema?.type).toBe('array');
    expect(
      request.generationConfig.responseJsonSchema?.items?.properties,
    ).toHaveProperty('recurrence');
    expect(
      request.generationConfig.responseJsonSchema?.items?.properties,
    ).not.toHaveProperty('batchGroupId');
    expect(request.generationConfig.responseSchema).toBeUndefined();
  });

  it('expands one semantic AI recurrence with the shared date engine', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([{
                id: '',
                title: 'Học yoga',
                date: '2026-09-07',
                startTime: '05:00',
                reminderMinutes: 15,
                priority: 'none',
                recurrence: {
                  frequency: 'weekly',
                  interval: 1,
                  startDate: '2026-09-07',
                  endDate: '2026-09-17',
                  count: null,
                  weekdays: [1, 4],
                  monthDays: [],
                  monthlyWeekday: null,
                  excludedDates: [],
                },
              }]),
            }],
          },
        }],
      }),
    } as Response);
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'MOI SANG THU 2 VA THU 5 HANG THANG VAO LUC 5H SE HOC YOGA den ngay 17/09/2026',
      context,
    );

    expect(result.map((draft) => draft.date)).toEqual([
      '2026-09-07',
      '2026-09-10',
      '2026-09-14',
      '2026-09-17',
    ]);
    expect(new Set(result.map((draft) => draft.id)).size).toBe(4);
    expect(new Set(result.map((draft) => draft.batchGroupId)).size).toBe(1);
  });

  it('accepts a valid AI rule for wording the offline fallback does not know', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([{
                id: '',
                title: 'Tưới cây',
                date: '2026-09-07',
                startTime: '07:00',
                reminderMinutes: 15,
                priority: 'none',
                recurrence: {
                  frequency: 'daily',
                  interval: 2,
                  startDate: '2026-09-07',
                  endDate: '2026-09-13',
                  count: null,
                  weekdays: [],
                  monthDays: [],
                  monthlyWeekday: null,
                  excludedDates: [],
                },
              }]),
            }],
          },
        }],
      }),
    } as Response);
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'cứ cách nhật lúc 7h tưới cây',
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.map((draft) => draft.date)).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
      '2026-09-13',
    ]);
  });

  it('asks Gemini to repair a malformed semantic recurrence rule', async () => {
    const response = (recurrence: object) => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([{
                id: '',
                title: 'Đi bộ',
                date: '2026-09-07',
                startTime: '06:00',
                reminderMinutes: 15,
                priority: 'none',
                recurrence,
              }]),
            }],
          },
        }],
      }),
    } as Response);
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(response({
        frequency: 'weekly',
        interval: 1,
        startDate: '2026-09-07',
        endDate: '2026-09-14',
        weekdays: [],
      }))
      .mockResolvedValueOnce(response({
        frequency: 'daily',
        interval: 1,
        startDate: '2026-09-07',
        endDate: '2026-09-09',
        weekdays: [],
      }));
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'mỗi sáng đi bộ lúc 6h đến ngày 09/09/2026',
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('batch_mismatch');
    expect(result.map((draft) => draft.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
  });

  it('falls back locally after one unsuccessful Gemini repair', async () => {
    const invalidResponse = {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify([
                    {
                      id: 'metadata-task',
                      title: 'Thoi luong 1h30p',
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
    } as Response;
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(invalidResponse);
    global.fetch = fetchMock;

    const result = await new PlanlyAiProvider('test-key').parseScheduleRequest(
      'tao lich 2h da bong, muc uu tien vua va thoi luong 1h30p nhac dung gio',
      context,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Da bong',
      startTime: '02:00',
      reminderMinutes: 0,
      priority: 'medium',
    });
  });

  it('requests clarification before calling Gemini for an ambiguous time', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    global.fetch = fetchMock;

    await expect(
      new PlanlyAiProvider('test-key').parseScheduleRequest(
        'tao lich 2h toi da bong',
        context,
      ),
    ).rejects.toBeInstanceOf(AiScheduleClarificationError);
    expect(fetchMock).not.toHaveBeenCalled();
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
