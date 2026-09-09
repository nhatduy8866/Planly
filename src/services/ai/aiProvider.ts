import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import { isValidDateKey, resolveScheduleDate } from './dateIntent';
import { parseVietnameseScheduleText, refineVietnameseSchedule } from './nlpParser';
import { isReorderIntent } from './scheduleIntent';
import { isTaskUpdateIntent } from './taskUpdateIntent';

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

interface CloudDraftDefaults {
  id: string;
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

function normalizeDuration(value: unknown): number {
  const duration = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(duration) && duration >= 5 ? Math.round(duration) : 30;
}

function normalizeReminder(value: unknown): AiDraftTask['reminderMinutes'] {
  const reminder = value === null ? null : value;
  return VALID_REMINDERS.has(reminder as AiDraftTask['reminderMinutes'])
    ? (reminder as AiDraftTask['reminderMinutes'])
    : 15;
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
    title: nonEmptyString(item.title) || defaults.title,
    date: isValidDateKey(item.date) ? item.date : defaults.date,
    startTime: normalizeStartTime(item.startTime),
    durationMinutes: normalizeDuration(item.durationMinutes),
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
    // Reorder phải giữ đúng ID task hiện có, nên dùng luồng deterministic thay vì
    // phụ thuộc vào việc model có tuân thủ prompt hay không.
    if (isReorderIntent(prompt) || isTaskUpdateIntent(prompt)) {
      return parseVietnameseScheduleText(prompt, context);
    }

    const key = this.getApiKey();
    // Nếu có API key, gọi trực tiếp Gemini API
    if (key) {
      try {
        const cloudResult = await this.callGeminiApi(prompt, context, key);
        if (cloudResult && cloudResult.length > 0) {
          return cloudResult;
        }
      } catch (err) {
        console.warn('Lỗi gọi Gemini Cloud API, chuyển sang Offline NLP:', err);
      }
    }

    // Luôn có bộ phân tích Offline NLP chất lượng cao sẵn sàng
    return parseVietnameseScheduleText(prompt, context);
  }

  async refineSchedule(
    currentDrafts: AiDraftTask[],
    instruction: string,
    context: AiSchedulingContext,
  ): Promise<AiDraftTask[]> {
    const key = this.getApiKey();
    if (key) {
      try {
        const cloudResult = await this.callGeminiRefineApi(
          currentDrafts,
          instruction,
          context,
          key,
        );
        if (cloudResult && cloudResult.length > 0) {
          return cloudResult;
        }
      } catch (err) {
        console.warn('Lỗi gọi Gemini Refine API, chuyển sang Offline NLP:', err);
      }
    }
    return refineVietnameseSchedule(currentDrafts, instruction, context);
  }

  private async callGeminiApi(
    prompt: string,
    context: AiSchedulingContext,
    apiKey: string,
  ): Promise<AiDraftTask[] | null> {
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const realToday = context.realToday || context.targetDate;
    const realTodayDayName = context.realTodayDayName || context.currentDayName;

    const effectiveDate = resolveScheduleDate(prompt, context).date;

    const tasksForDate = (context.allTasks || context.existingTasks).filter(
      (t) => t.date === effectiveDate && !t.completed,
    );

    const existingTasksSummary = tasksForDate.map((t) => ({
      id: t.id,
      title: t.title,
      startTime: t.startTime,
      durationMinutes: t.durationMinutes,
      priority: t.priority,
    }));

    const promptText = `Bạn là trợ lý lập lịch thông minh của ứng dụng Planly. Phân tích yêu cầu lập lịch của người dùng:
Ngữ cảnh thời gian:
- Ngày thực tế hôm nay của thiết bị: ${realToday} (${realTodayDayName})
- Ngày người dùng đang mở xem trên màn hình: ${context.targetDate} (${context.currentDayName})
- Danh sách công việc hiện có trong ngày (${tasksForDate.length} việc): ${JSON.stringify(existingTasksSummary)}
Yêu cầu của người dùng: "${prompt}"

Quy tắc quan trọng:
1. NẾU YÊU CẦU LÀ SẮP XẾP LẠI CÁC VIỆC TRONG NGÀY (Reorder / Reschedule cả ngày):
   - Tuyệt đối KHÔNG tạo một công việc mới mang tên "Sắp xếp các công việc" hay "Sắp xếp lại các công việc".
   - Hãy lấy danh sách công việc HIỆN CÓ, tự động tính toán lại khung giờ (startTime) hợp lý, không bị trùng nhau và tối ưu theo thứ tự ưu tiên (ưu tiên cao xếp sáng, vừa xếp chiều, thấp xếp sau).
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
5. "durationMinutes": Số phút làm việc (mặc định 30).
6. "reminderMinutes": 0, 5, 10, 15, 30, hoặc 60 (mặc định 15 nếu không yêu cầu).
7. "priority": "high", "medium", "low", hoặc "none".

Trả về duy nhất mảng JSON hợp lệ:
[
  {
    "id": "giữ nguyên id từ danh sách việc cũ nếu sắp xếp lại, hoặc để trống nếu là việc mới",
    "title": "Tên việc ngắn gọn",
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "durationMinutes": 30,
    "priority": "none",
    "reminderMinutes": 15
  }
]`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) continue;
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

          return {
            ...normalizeCloudDraft(item, {
              id: normalizedId,
              title: `Công việc ${index + 1}`,
              date: effectiveDate,
              source,
              changeStatus,
            }),
            id: normalizedId,
            source,
            changeStatus,
          };
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
  ): Promise<AiDraftTask[] | null> {
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    const promptText = `Bạn là trợ lý lập lịch AI của Planly. Cập nhật danh sách công việc dự thảo hiện tại dựa trên câu lệnh tinh chỉnh của người dùng:
Danh sách hiện tại: ${JSON.stringify(currentDrafts)}
Câu lệnh tinh chỉnh: "${instruction}"
Ngữ cảnh ngày: ${context.targetDate}

Trả về mảng JSON công việc mới sau khi áp dụng tinh chỉnh (thêm việc mới, xóa việc, hoặc dời giờ/thời lượng).
Nếu công việc bị thay đổi, gán changeStatus: "updated".`;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = {
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) continue;
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
