import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import type { TaskRecurrenceRule } from '../../types/recurrence';
import {
  addCalendarMonths,
  buildTaskRecurrenceDates,
} from '../../utils/taskBatch';
import { addDays, fromDateKey, toDateKey } from '../../utils/date';
import { isValidDateKey, resolveScheduleDate } from './dateIntent';
import { parseVietnameseScheduleText, refineVietnameseSchedule } from './nlpParser';
import {
  AiScheduleClarificationError,
  findScheduleClarification,
} from './scheduleClarification';
import { isReorderIntent } from './scheduleIntent';
import {
  validateAiRefinementResult,
  validateAiScheduleResult,
  type AiScheduleValidationIssue,
} from './scheduleResultValidator';
import { isTaskUpdateIntent } from './taskUpdateIntent';
import { resolveAiRecurrenceEndDate } from './batchIntent';

/**
 * Giao diện nhà cung cấp dịch vụ AI (Interface Segregation Principle)
 */
export interface AiSchedulingProvider {
  parseScheduleRequest(
    prompt: string,
    context: AiSchedulingContext,
  ): Promise<AiDraftTask[]>;

  refineSchedule(
    currentDrafts: AiDraftTask[],
    instruction: string,
    context: AiSchedulingContext,
  ): Promise<AiDraftTask[]>;
}

const VALID_REMINDERS: ReadonlySet<AiDraftTask['reminderMinutes']> = new Set([
  null,
  0,
  5,
  10,
  15,
  30,
  60,
]);
const VALID_PRIORITIES: ReadonlySet<AiDraftTask['priority']> = new Set([
  'high',
  'medium',
  'low',
  'none',
]);
const VALID_SOURCES: ReadonlySet<AiDraftTask['source']> = new Set([
  'direct_request',
  'auto_slotted',
  'conflict_resolved',
]);
const VALID_CHANGE_STATUSES: ReadonlySet<
  NonNullable<AiDraftTask['changeStatus']>
> = new Set(['unchanged', 'updated', 'added']);

const SCHEDULE_RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      date: { type: 'string', format: 'date' },
      startTime: { type: 'string' },
      priority: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
      reminderMinutes: {
        type: ['integer', 'null'],
        enum: [null, 0, 5, 10, 15, 30, 60],
      },
      recurrence: {
        type: ['object', 'null'],
        description:
          'A compact recurrence rule, or null for a one-time task. Never enumerate occurrences.',
        additionalProperties: false,
        properties: {
          frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
          },
          interval: { type: 'integer', minimum: 1, maximum: 365 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: ['string', 'null'], format: 'date' },
          count: { type: ['integer', 'null'], minimum: 1, maximum: 366 },
          weekdays: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
          },
          monthDays: {
            type: 'array',
            items: { type: 'integer', minimum: -31, maximum: 31 },
          },
          monthlyWeekday: {
            type: ['object', 'null'],
            additionalProperties: false,
            properties: {
              weekday: { type: 'integer', minimum: 0, maximum: 6 },
              ordinal: {
                type: 'integer',
                enum: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5],
              },
            },
            required: ['weekday', 'ordinal'],
          },
          excludedDates: {
            type: 'array',
            items: { type: 'string', format: 'date' },
          },
        },
        required: [
          'frequency',
          'interval',
          'startDate',
          'endDate',
          'count',
          'weekdays',
          'monthDays',
          'monthlyWeekday',
          'excludedDates',
        ],
      },
    },
    required: [
      'id',
      'title',
      'date',
      'startTime',
      'priority',
      'reminderMinutes',
      'recurrence',
    ],
  },
} as const;

const REFINEMENT_RESPONSE_SCHEMA = {
  ...SCHEDULE_RESPONSE_SCHEMA,
  items: {
    ...SCHEDULE_RESPONSE_SCHEMA.items,
    properties: {
      id: { type: 'string' },
      batchGroupId: { type: 'string' },
      title: { type: 'string' },
      date: { type: 'string', format: 'date' },
      startTime: { type: 'string' },
      priority: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
      reminderMinutes: {
        type: ['integer', 'null'],
        enum: [null, 0, 5, 10, 15, 30, 60],
      },
    },
    required: [
      'id',
      'batchGroupId',
      'title',
      'date',
      'startTime',
      'priority',
      'reminderMinutes',
    ],
  },
} as const;

interface RepairRequest {
  issues: AiScheduleValidationIssue[];
  previousDrafts: AiDraftTask[];
}

interface CloudDraftDefaults {
  id: string;
  batchGroupId?: string;
  title: string;
  date: string;
  source: AiDraftTask['source'];
  changeStatus: NonNullable<AiDraftTask['changeStatus']>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeStartTime(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return '';

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeReminder(value: unknown): AiDraftTask['reminderMinutes'] {
  const reminder = value === null ? null : value;
  return VALID_REMINDERS.has(reminder as AiDraftTask['reminderMinutes'])
    ? (reminder as AiDraftTask['reminderMinutes'])
    : 15;
}

function numberArray(
  value: unknown,
  isAllowed: (item: number) => boolean,
): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(
    (item): item is number => Number.isInteger(item) && isAllowed(item),
  ))).sort((first, second) => first - second);
}

function normalizeCloudRecurrence(
  value: unknown,
  defaultStartDate: string,
  explicitEndDate: string | null,
): TaskRecurrenceRule | null {
  if (value === null || value === undefined) return null;
  const item = asRecord(value);
  const frequency = nonEmptyString(item.frequency);
  if (!frequency || !['daily', 'weekly', 'monthly'].includes(frequency)) {
    return null;
  }

  const startDate = isValidDateKey(item.startDate)
    ? item.startDate
    : defaultStartDate;
  const interval = Number.isInteger(item.interval) && Number(item.interval) > 0
    ? Math.min(Number(item.interval), 365)
    : 1;
  const count = Number.isInteger(item.count) && Number(item.count) > 0
    ? Math.min(Number(item.count), 366)
    : undefined;
  const endDate = explicitEndDate ?? (
    isValidDateKey(item.endDate)
      ? item.endDate
      : count
        ? toDateKey(addDays(fromDateKey(startDate), 365))
        : addCalendarMonths(startDate, 3)
  );
  const weekdays = numberArray(item.weekdays, (day) => day >= 0 && day <= 6);
  const monthDays = numberArray(
    item.monthDays,
    (day) => day !== 0 && day >= -31 && day <= 31,
  );
  const monthlyWeekdayValue = asRecord(item.monthlyWeekday);
  const monthlyWeekday =
    Number.isInteger(monthlyWeekdayValue.weekday) &&
    Number(monthlyWeekdayValue.weekday) >= 0 &&
    Number(monthlyWeekdayValue.weekday) <= 6 &&
    Number.isInteger(monthlyWeekdayValue.ordinal) &&
    Number(monthlyWeekdayValue.ordinal) !== 0 &&
    Math.abs(Number(monthlyWeekdayValue.ordinal)) <= 5
      ? {
          weekday: Number(monthlyWeekdayValue.weekday),
          ordinal: Number(monthlyWeekdayValue.ordinal),
        }
      : undefined;
  const excludedDates = Array.isArray(item.excludedDates)
    ? Array.from(new Set(item.excludedDates.filter(isValidDateKey)))
    : [];

  if (frequency === 'weekly' && weekdays.length === 0) return null;
  if (
    frequency === 'monthly' &&
    monthDays.length === 0 &&
    monthlyWeekday === undefined
  ) {
    return null;
  }
  if (frequency === 'monthly' && monthDays.length > 0 && monthlyWeekday) {
    return null;
  }

  return {
    frequency: frequency as TaskRecurrenceRule['frequency'],
    interval,
    startDate,
    endDate,
    count,
    ...(frequency === 'weekly' ? { weekdays } : {}),
    ...(frequency === 'monthly' && monthDays.length ? { monthDays } : {}),
    ...(frequency === 'monthly' && monthlyWeekday ? { monthlyWeekday } : {}),
    ...(excludedDates.length ? { excludedDates } : {}),
  };
}

function normalizeCloudDraft(
  value: unknown,
  defaults: CloudDraftDefaults,
): AiDraftTask {
  const item = asRecord(value);
  const priority = nonEmptyString(item.priority);
  const source = nonEmptyString(item.source);
  const changeStatus = nonEmptyString(item.changeStatus);

  return {
    id: nonEmptyString(item.id) || defaults.id,
    batchGroupId:
      nonEmptyString(item.batchGroupId) || defaults.batchGroupId,
    title: nonEmptyString(item.title) || defaults.title,
    date: isValidDateKey(item.date) ? item.date : defaults.date,
    startTime: normalizeStartTime(item.startTime),
    reminderMinutes: normalizeReminder(item.reminderMinutes),
    priority:
      priority && VALID_PRIORITIES.has(priority as AiDraftTask['priority'])
        ? (priority as AiDraftTask['priority'])
        : 'none',
    source:
      source && VALID_SOURCES.has(source as AiDraftTask['source'])
        ? (source as AiDraftTask['source'])
        : defaults.source,
    changeStatus:
      changeStatus &&
      VALID_CHANGE_STATUSES.has(
        changeStatus as NonNullable<AiDraftTask['changeStatus']>,
      )
        ? (changeStatus as NonNullable<AiDraftTask['changeStatus']>)
        : defaults.changeStatus,
  };
}

/**
 * Triển khai mặc định: Hỗ trợ Offline Heuristic NLP và Gemini Cloud LLM
 */
export class PlanlyAiProvider implements AiSchedulingProvider {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getApiKey(): string | undefined {
    return this.apiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  }

  async parseScheduleRequest(
    prompt: string,
    context: AiSchedulingContext,
  ): Promise<AiDraftTask[]> {
    const clarification = findScheduleClarification(prompt);
    if (clarification) throw clarification;

    // Reorder phải giữ đúng ID task hiện có, nên dùng luồng deterministic thay vì
    // phụ thuộc vào việc model có tuân thủ prompt hay không.
    if (isReorderIntent(prompt) || isTaskUpdateIntent(prompt)) {
      return parseVietnameseScheduleText(prompt, context);
    }

    const localResult = parseVietnameseScheduleText(prompt, context);
    const key = this.getApiKey();
    // Nếu có API key, gọi trực tiếp Gemini API
    if (key) {
      try {
        const cloudResult = await this.callGeminiApi(prompt, context, key);
        if (cloudResult) {
          const validation = validateAiScheduleResult(
            prompt,
            cloudResult,
            localResult,
          );
          if (validation.valid) return cloudResult;

          const repairedResult = await this.callGeminiApi(
            prompt,
            context,
            key,
            {
              issues: validation.issues,
              previousDrafts: cloudResult,
            },
          );
          if (
            repairedResult &&
            validateAiScheduleResult(prompt, repairedResult, localResult).valid
          ) {
            return repairedResult;
          }
        }
      } catch (err) {
        if (err instanceof AiScheduleClarificationError) throw err;
        console.warn('Lỗi gọi Gemini Cloud API, chuyển sang Offline NLP:', err);
      }
    }

    // Luôn có bộ phân tích Offline NLP chất lượng cao sẵn sàng
    return localResult;
  }

  async refineSchedule(
    currentDrafts: AiDraftTask[],
    instruction: string,
    context: AiSchedulingContext,
  ): Promise<AiDraftTask[]> {
    const localResult = refineVietnameseSchedule(
      currentDrafts,
      instruction,
      context,
    );
    const key = this.getApiKey();
    if (key) {
      try {
        const cloudResult = await this.callGeminiRefineApi(
          currentDrafts,
          instruction,
          context,
          key,
        );
        if (cloudResult) {
          const validation = validateAiRefinementResult(
            instruction,
            currentDrafts,
            cloudResult,
            localResult,
          );
          if (validation.valid) return cloudResult;

          const repairedResult = await this.callGeminiRefineApi(
            currentDrafts,
            instruction,
            context,
            key,
            {
              issues: validation.issues,
              previousDrafts: cloudResult,
            },
          );
          if (
            repairedResult &&
            validateAiRefinementResult(
              instruction,
              currentDrafts,
              repairedResult,
              localResult,
            ).valid
          ) {
            return repairedResult;
          }
        }
      } catch (err) {
        console.warn('Lỗi gọi Gemini Refine API, chuyển sang Offline NLP:', err);
      }
    }
    return localResult;
  }

  private async callGeminiApi(
    prompt: string,
    context: AiSchedulingContext,
    apiKey: string,
    repair?: RepairRequest,
  ): Promise<AiDraftTask[] | null> {
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const realToday = context.realToday || context.targetDate;
    const realTodayDayName = context.realTodayDayName || context.currentDayName;

    const effectiveDate = resolveScheduleDate(prompt, context).date;
    const explicitRecurrenceEndDate = resolveAiRecurrenceEndDate(
      prompt,
      context,
    );

    const tasksForDate = (context.allTasks || context.existingTasks).filter(
      (t) => t.date === effectiveDate && !t.completed,
    );

    const existingTasksSummary = tasksForDate.map((t) => ({
      id: t.id,
      title: t.title,
      startTime: t.startTime,
      priority: t.priority,
    }));

    const repairInstruction = repair
      ? `\nKết quả trước cần được sửa: ${JSON.stringify(repair.previousDrafts)}\nCác lỗi validator phát hiện:\n${repair.issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n')}\nHãy phân tích lại yêu cầu gốc và sửa toàn bộ lỗi trên. Không sao chép lại kết quả sai.`
      : '';
    const boundInfo = explicitRecurrenceEndDate
      ? `\n- Giới hạn ngày kết thúc: ${explicitRecurrenceEndDate}. BẮT BUỘC gán recurrence.endDate bằng "${explicitRecurrenceEndDate}".`
      : '';
    const promptText = `Bạn là trợ lý lập lịch thông minh của ứng dụng Planly. Phân tích yêu cầu lập lịch của người dùng:
Ngữ cảnh thời gian:
- Ngày thực tế hôm nay của thiết bị: ${realToday} (${realTodayDayName})
- Ngày người dùng đang mở xem trên màn hình: ${context.targetDate} (${context.currentDayName})
- Danh sách công việc hiện có trong ngày (${tasksForDate.length} việc): ${JSON.stringify(existingTasksSummary)}${boundInfo}
Yêu cầu gốc của người dùng: "${prompt}"${repairInstruction}

Quy tắc quan trọng:
0. Người dùng có thể nhập tiếng Việt không dấu. Hãy hiểu các cụm như "tao lich", "muc uu tien vua", "thoi luong 1h30p", "nhac dung gio" tương đương với bản có dấu. Mệnh đề mô tả ưu tiên, thời lượng hoặc nhắc hẹn là thuộc tính của công việc đứng trước, không được tách chúng thành công việc mới. Hiện JSON chưa có trường thời lượng, vì vậy không đưa cụm thời lượng vào title và không diễn giải nó thành startTime.
1. NẾU YÊU CẦU LÀ SẮP XẾP LẠI CÁC VIỆC TRONG NGÀY (Reorder / Reschedule cả ngày):
   - Tuyệt đối KHÔNG tạo một công việc mới mang tên "Sắp xếp các công việc" hay "Sắp xếp lại các công việc".
   - Hãy lấy danh sách công việc HIỆN CÓ, tự động tính toán lại giờ bắt đầu (startTime) hợp lý, không bị trùng nhau và tối ưu theo thứ tự ưu tiên (ưu tiên cao xếp sáng, vừa xếp chiều, thấp xếp sau).
   - BẮT BUỘC giữ nguyên trường "id" của các công việc hiện có để hệ thống cập nhật giờ mà không bị trùng lặp công việc.
   - Nếu trong ngày chưa có công việc nào để sắp xếp, trả về mảng rỗng [].
2. "date": Ngày diễn ra công việc (định dạng YYYY-MM-DD):
   - Mọi từ chỉ thời gian tương đối như "hôm nay", "mai", "ngày mai", "ngày kia", "ngày mốt", "tuần này": BẮT BUỘC PHẢI TÍNH THEO NGÀY THỰC TẾ HÔM NAY (${realToday}).
     Ví dụ: Nếu hôm nay là ${realToday} (${realTodayDayName}), thì "ngày mai" hoặc "mai" BẮT BUỘC là ngày kế tiếp (+1 ngày).
   - Nếu người dùng nói thứ cụ thể (ví dụ "thứ 4", "thứ 6"): tính thứ gần nhất tới đây tính từ ${realToday}.
   - CHỈ KHI người dùng KHÔNG hề nhắc đến bất kỳ từ chỉ ngày nào (ví dụ: "dọn nhà lúc 8h", "họp team"): mới gán "date" bằng ngày đang xem (${context.targetDate}).
3. "title": Chỉ lấy nội dung hành động chính (ví dụ: "Đi chơi", "Họp nhóm", "Đọc sách"), tuyệt đối không để các từ đệm ("tôi muốn", "hãy tạo", "lên lịch", "nhắc tôi").
4. "startTime": Định dạng 24h "HH:mm":
   - Nếu có giờ cụ thể (ví dụ 4h chiều -> "16:00", 9h30 -> "09:30").
   - NẾU NGƯỜI DÙNG NÓI BUỔI (không nói số giờ cụ thể), HÃY TỰ ĐỘNG GÁN GIỜ HỢP LÝ PHÂN BỔ TRONG NGÀY:
     + Buổi sáng ("sáng", "buổi sáng"): gán "08:30" hoặc "09:00".
     + Buổi trưa ("trưa", "buổi trưa"): gán "12:00".
     + Buổi chiều ("chiều", "buổi chiều"): gán "14:30" hoặc "15:00".
     + Buổi tối ("tối", "buổi tối" - lưu ý nhận diện lỗi gõ thiếu dấu "tôi" thành "tối" trong chuỗi: "sáng..., chiều..., tôi..."): gán "19:30" hoặc "20:00".
   - Chỉ để "" nếu hoàn toàn không có thông tin buổi hay giờ nào.
5. "reminderMinutes": 0, 5, 10, 15, 30, hoặc 60 (mặc định 15 nếu không yêu cầu).
6. "priority": "high", "medium", "low", hoặc "none".
7. "recurrence": hãy diễn giải Ý NGHĨA lặp lại thành một quy tắc gọn, KHÔNG tự liệt kê từng ngày:
   - Không lặp: null.
   - frequency là daily, weekly hoặc monthly; interval mặc định 1. "Cứ N ngày" hoặc "cách nhật" là daily với interval tương ứng ("cách nhật" hoặc "cứ 2 ngày" là interval 2).
   - weekday dùng quy ước Chủ nhật=0, Thứ Hai=1, ... Thứ Bảy=6.
   - "mỗi sáng đi bộ" là daily. Giờ cụ thể như "6h sáng" vẫn phải thắng giờ mặc định của buổi.
   - Danh sách thứ thường như "thứ 2 và thứ 5" là weekly, kể cả câu có thêm từ nối dài hoặc cụm "hàng tháng" không mô tả thứ tự trong tháng.
   - Danh sách ngày trong tháng như "ngày 2 và ngày 5 hàng tháng" là monthly với monthDays [2,5].
   - Chỉ dùng monthlyWeekday khi có thứ tự rõ ràng, ví dụ "Thứ Hai đầu mỗi tháng" là {weekday:1, ordinal:1}, "Thứ Sáu cuối tháng" là ordinal:-1.
   - startDate là ngày bắt đầu hiệu lực. Nếu người dùng nói "đến ngày...", endDate BẮT BUỘC là ngày đó (định dạng YYYY-MM-DD), không được để null. Chỉ để null khi người dùng hoàn toàn không có ngày kết thúc. count chỉ có giá trị khi người dùng giới hạn số lần.
   - weekdays/monthDays/excludedDates là [] và monthlyWeekday là null khi không dùng.
   - Câu có hoặc không dấu, viết hoa/thường, hay nhiều từ nối vẫn phải được hiểu theo cùng ý nghĩa.

Trả về duy nhất mảng JSON hợp lệ:
[
  {
    "id": "giữ nguyên id từ danh sách việc cũ nếu sắp xếp lại, hoặc để trống nếu là việc mới",
    "title": "Tên việc ngắn gọn",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "priority": "none",
    "reminderMinutes": 15,
    "recurrence": null
  }
]`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: SCHEDULE_RESPONSE_SCHEMA,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          console.warn(`Gemini scheduling request failed (${model}, HTTP ${res.status}).`);
          continue;
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) continue;

        const seenIds = new Set<string>();
        return parsed.flatMap<AiDraftTask>((value, index) => {
          const item = asRecord(value);
          const rawItemId = nonEmptyString(item.id);
          const itemTitle = nonEmptyString(item.title);
          const isPlaceholderId =
            !rawItemId ||
            rawItemId.toLowerCase() === 'string' ||
            rawItemId.toLowerCase() === 'null' ||
            rawItemId.toLowerCase() === 'undefined';
          const matchedTask = tasksForDate.find(
            (t) =>
              (!isPlaceholderId && t.id === rawItemId) ||
              (itemTitle !== undefined &&
                t.title.trim().toLowerCase() === itemTitle.toLowerCase()),
          );
          const source = matchedTask ? 'auto_slotted' : 'direct_request';
          const changeStatus = matchedTask ? 'updated' : 'unchanged';

          let normalizedId: string;
          if (matchedTask?.id) {
            normalizedId = matchedTask.id;
          } else if (rawItemId && !isPlaceholderId && !seenIds.has(rawItemId)) {
            normalizedId = rawItemId;
          } else {
            normalizedId = `ai-gemini-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`;
          }
          seenIds.add(normalizedId);

          const normalized = normalizeCloudDraft(item, {
            id: normalizedId,
            title: `Công việc ${index + 1}`,
            date: effectiveDate,
            source,
            changeStatus,
          });
          const recurrence = normalizeCloudRecurrence(
            item.recurrence,
            normalized.date,
            explicitRecurrenceEndDate,
          );
          if (!recurrence) {
            return [{
              ...normalized,
              id: normalizedId,
              ...(item.recurrence !== null && item.recurrence !== undefined
                ? { batchGroupId: `invalid-ai-recurrence-${index}` }
                : {}),
            }];
          }

          const occurrenceDates = buildTaskRecurrenceDates(recurrence);
          if (!occurrenceDates.length) {
            return [{
              ...normalized,
              id: normalizedId,
              batchGroupId: `invalid-ai-recurrence-${index}`,
            }];
          }

          const batchGroupId = `ai-batch-cloud-${Date.now()}-${index}`;
          return occurrenceDates.map((date, occurrenceIndex) => ({
            ...normalized,
            id: `${normalizedId}-${occurrenceIndex}`,
            date,
            batchGroupId,
          }));
        });
      } catch {
        continue;
      }
    }
    return null;
  }

  private async callGeminiRefineApi(
    currentDrafts: AiDraftTask[],
    instruction: string,
    context: AiSchedulingContext,
    apiKey: string,
    repair?: RepairRequest,
  ): Promise<AiDraftTask[] | null> {
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const repairInstruction = repair
      ? `\nKết quả trước cần được sửa: ${JSON.stringify(repair.previousDrafts)}\nCác lỗi validator phát hiện:\n${repair.issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n')}\nHãy sửa toàn bộ lỗi và vẫn giữ đúng id của công việc cũ.`
      : '';
    const promptText = `Bạn là trợ lý lập lịch AI của Planly. Cập nhật danh sách công việc dự thảo hiện tại dựa trên câu lệnh tinh chỉnh của người dùng:
Danh sách hiện tại: ${JSON.stringify(currentDrafts)}
Câu lệnh tinh chỉnh: "${instruction}"${repairInstruction}
Ngữ cảnh ngày: ${context.targetDate}
Người dùng có thể nhập tiếng Việt không dấu; hãy hiểu tương đương bản có dấu và giữ đúng id, batchGroupId của công việc được nhắc đến.

Trả về mảng JSON công việc mới sau khi áp dụng tinh chỉnh (thêm việc mới, xóa việc hoặc dời giờ bắt đầu).
Luôn giữ nguyên id và batchGroupId của công việc cũ; Planly sẽ tự tính trạng thái thay đổi sau khi nhận kết quả.`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: REFINEMENT_RESPONSE_SCHEMA,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          console.warn(`Gemini refinement request failed (${model}, HTTP ${res.status}).`);
          continue;
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) continue;

        const seenIds = new Set<string>();
        return parsed.map((value, index) => {
          const item = asRecord(value);
          const rawItemId = nonEmptyString(item.id);
          const itemTitle = nonEmptyString(item.title);
          const isPlaceholderId =
            !rawItemId ||
            rawItemId.toLowerCase() === 'string' ||
            rawItemId.toLowerCase() === 'null' ||
            rawItemId.toLowerCase() === 'undefined';
          const matchedDraft = currentDrafts.find(
            (draft) =>
              (!isPlaceholderId && draft.id === rawItemId) ||
              (itemTitle !== undefined &&
                draft.title.trim().toLowerCase() === itemTitle.toLowerCase()),
          );

          let normalizedId: string;
          if (matchedDraft?.id) {
            normalizedId = matchedDraft.id;
          } else if (rawItemId && !isPlaceholderId && !seenIds.has(rawItemId)) {
            normalizedId = rawItemId;
          } else {
            normalizedId = `ai-gemini-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`;
          }
          seenIds.add(normalizedId);

          const normalized = normalizeCloudDraft(item, {
            id: normalizedId,
            batchGroupId: matchedDraft?.batchGroupId,
            title: `Công việc ${index + 1}`,
            date: matchedDraft?.date || context.targetDate,
            source: matchedDraft?.source || 'direct_request',
            changeStatus: 'updated',
          });

          return {
            ...normalized,
            id: normalizedId,
          };
        });
      } catch {
        continue;
      }
    }
    return null;
  }
}

/**
 * Singleton instance của AI Provider để toàn app sử dụng
 */
export const defaultAiProvider: AiSchedulingProvider = new PlanlyAiProvider();
