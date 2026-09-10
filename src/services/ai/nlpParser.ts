import type { ReminderMinutes, TaskPriority } from '../../types';
import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import {
  isVietnameseTaskAttributeClause,
  normalizeVietnameseText,
  replaceVietnameseMatches,
} from '../../utils/vietnameseText';
import {
  resolveScheduleDate,
  stripScheduleDateReferences,
} from './dateIntent';
import {
  parseAiBatchSchedule,
  stripAiBatchScheduleReferences,
} from './batchIntent';
import { isReorderIntent } from './scheduleIntent';
import { autoSlotTasks } from './slottingEngine';
import { resolveExistingTaskUpdate } from './taskUpdateIntent';
import { parseVietnameseTime } from './timeIntent';

export { isReorderIntent } from './scheduleIntent';

const NUMERIC_REMINDER_PATTERN =
  /(?:nhac|bao)\s+(?:(?:cho\s+)?(?:toi|minh|em)\s+)?(?:truoc\s+)?(\d+)\s*(?:phut|p|gio|g)?(?:\s*(?:nhe|nha|giup|voi))?/g;
const ON_TIME_REMINDER_PATTERN =
  /(?:nhac|bao)\s+(?:(?:cho\s+)?(?:toi|minh|em)\s+)?(?:dung\s+(?:gio|hen)|khi\s+den\s+gio)(?:\s*(?:nhe|nha|giup|voi))?/g;
const DURATION_CLAUSE_PATTERN =
  /(?:^|\s)(?:va\s+)?(?:thoi\s+luong|keo\s+dai)\s*(?:la\s+)?\d+\s*(?:(?:h|gio)(?:\s*\d+\s*(?:p|phut))?|p|phut)(?:\s*(?:nhe|nha))?/g;
const PRIORITY_CLAUSE_PATTERN =
  /(?:^|\s)(?:va\s+)?(?:muc\s+)?uu\s+tien\s*(?:la\s+)?(?:rat\s+)?(?:cao|vua|thap|gap|hang\s+dau)/g;

function parseReminder(text: string): ReminderMinutes {
  const normalized = normalizeVietnameseText(text);
  const candidates: { index: number; value: ReminderMinutes }[] = [];

  for (const match of normalized.matchAll(NUMERIC_REMINDER_PATTERN)) {
    const value = Number(match[1]);
    if ([0, 5, 10, 15, 30, 60].includes(value)) {
      candidates.push({ index: match.index ?? 0, value: value as ReminderMinutes });
    }
  }
  for (const match of normalized.matchAll(ON_TIME_REMINDER_PATTERN)) {
    candidates.push({ index: match.index ?? 0, value: 0 });
  }

  return candidates.sort((first, second) => first.index - second.index).at(-1)
    ?.value ?? 15;
}

function stripReminderClauses(text: string): string {
  return replaceVietnameseMatches(
    replaceVietnameseMatches(text, NUMERIC_REMINDER_PATTERN),
    ON_TIME_REMINDER_PATTERN,
  );
}

function parsePriority(text: string): TaskPriority {
  const normalized = normalizeVietnameseText(text);
  if (/gap|khan cap|rat quan trong|uu\s+tien\s+(?:rat\s+)?cao|hang dau/.test(normalized)) {
    return 'high';
  }
  if (/quan trong|(?:muc\s+)?uu\s+tien\s+(?:la\s+)?vua/.test(normalized)) {
    return 'medium';
  }
  if (/uu\s+tien\s+(?:la\s+)?thap|ranh thi lam|khong gap/.test(normalized)) {
    return 'low';
  }
  return 'none';
}

function startsWithTaskAttribute(text: string): boolean {
  return isVietnameseTaskAttributeClause(text);
}

function cleanTaskTitle(segment: string, parsedTimeText?: string): string {
  let title = stripScheduleDateReferences(
    stripAiBatchScheduleReferences(segment),
  );
  title = replaceVietnameseMatches(
    title,
    /^(?:toi\s+muon|hay\s+giup\s+toi|len\s+lich\s+giup|tao|them|toi\s+can|can|phai|hay)\s+(?:giup\s+(?:toi|minh)\s+)?(?:1\s+)?(?:(?:cuoc|lich)\s+hen|lich|viec|cong\s+viec)?\s*/,
    '',
  );
  if (parsedTimeText) title = title.replace(parsedTimeText, ' ');
  title = stripReminderClauses(title);
  title = replaceVietnameseMatches(title, PRIORITY_CLAUSE_PATTERN);
  title = replaceVietnameseMatches(title, DURATION_CLAUSE_PATTERN);
  title = title.replace(
    /(?:vào\s+)?(?:buổi\s+)?(?:sáng|trưa|chiều|tối)(?:\s+nay)?/gi,
    ' ',
  );
  title = replaceVietnameseMatches(
    title,
    /(?:vao\s+)?(?:(?:buoi\s+)?(?:sang|trua|chieu)|buoi\s+toi)(?:\s+nay)?/g,
  );
  title = title.trim();
  title = replaceVietnameseMatches(title, /^toi\s+/, '');
  title = replaceVietnameseMatches(
    title,
    /^(?:lam|can|phai|hay|se)\s+/,
    '',
  );
  title = title.replace(/\s+(?:nhé|nhe)\s*(?=$|[, .!?])/gi, ' ');
  return title
    .replace(/\s*[,.;]+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Phân tích yêu cầu lập lịch tự nhiên bằng tiếng Việt (Offline Heuristic NLP)
 */
export function parseVietnameseScheduleText(
  text: string,
  context: AiSchedulingContext,
): AiDraftTask[] {
  const normalized = text.trim();
  if (!normalized) return [];

  // 0. Nhận diện yêu cầu Sắp xếp lại / Tối ưu lịch trình (Reorder Intent)
  if (isReorderIntent(normalized)) {
    const targetDayKey = resolveScheduleDate(normalized, context).date;

    const dayTasks = (context.allTasks || context.existingTasks).filter(
      (t) => t.date === targetDayKey && !t.completed,
    );

    // Nếu ngày đó chưa có việc nào để sắp xếp, trả về mảng rỗng []
    if (dayTasks.length === 0) {
      return [];
    }

    // Chuyển các task hiện có thành draft và gán lại giờ không trùng nhau
    const draftsToReorder: AiDraftTask[] = dayTasks.map((t) => ({
      id: t.id,
      title: t.title,
      date: t.date,
      startTime: '',
      reminderMinutes: t.reminderMinutes ?? 15,
      priority: t.priority || 'none',
      source: 'auto_slotted',
      changeStatus: 'updated',
    }));

    return autoSlotTasks(draftsToReorder, [], targetDayKey);
  }

  const existingTaskUpdate = resolveExistingTaskUpdate(normalized, context);
  if (existingTaskUpdate !== null) return existingTaskUpdate;

  // 1. Tìm reminder chung trên bản chuẩn hóa để nhận cả câu có/không dấu.
  const globalReminder = parseReminder(normalized);

  // Loại bỏ câu mở đầu chung nếu có (ví dụ: "tạo giúp tôi 1 lịch trình 3 việc, ...", "lên lịch giúp tôi: ...")
  const strippedIntro = replaceVietnameseMatches(
    normalized,
    /^(?:tao|len|hay\s+len|lap)\s+(?:giup\s+(?:toi|minh)\s+)?(?:1\s+)?(?:lich(?:\s+trinh)?|ke\s+hoach)\s*(?:\d+\s*(?:viec|cong\s+viec))?\s*[,:]?\s*/,
    '',
  ).trim();

  // Loại bỏ toàn bộ các mệnh đề nhắc nhở trước khi tách việc để không bị cắt nhầm thành task riêng
  const cleanNormalized = stripReminderClauses(strippedIntro).trim();

  // Tách văn bản thành các câu hoặc mệnh đề công việc
  // Dấu phân cách lớn: xuống dòng, dấu chấm phẩy, từ nối hành động ("sau đó", "tiếp theo", "xong rồi", "rồi")
  const baseSegments = separateTimedConjunctions(cleanNormalized)
    .split(/[\n;]|(?:\s+(?:sau đó|sau do|tiếp theo|tiep theo|xong rồi|xong roi|rồi|roi)\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  // Phân đoạn nhỏ hơn: Chỉ tách dấu phẩy hoặc dấu chấm nếu vế tiếp theo thực sự có mốc thời gian hoặc từ chỉ buổi
  const rawSegments: string[] = [];
  for (const seg of baseSegments) {
    const parts = seg.split(/[,.]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      let currentPart = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        const withoutDuration = replaceVietnameseMatches(
          p,
          DURATION_CLAUSE_PATTERN,
        );
        const hasTime =
          parseVietnameseTime(withoutDuration) !== null ||
          /\b(?:buoi\s*)?(?:sang|trua|chieu|toi)\b/.test(
            normalizeVietnameseText(withoutDuration),
          );
        if (hasTime && !startsWithTaskAttribute(p)) {
          rawSegments.push(currentPart);
          currentPart = p;
        } else {
          currentPart += `, ${p}`;
        }
      }
      rawSegments.push(currentPart);
    } else {
      rawSegments.push(seg);
    }
  }

  const drafts: AiDraftTask[] = [];
  let index = 1;
  let inheritedTaskDate = context.targetDate;

  for (const seg of rawSegments) {
    if (seg.length < 3) continue;

    // 1. Phân tích Ngày (Date) từ cùng một resolver dùng bởi provider.
    const batchSchedule = parseAiBatchSchedule(seg, context);
    const dateResolution = resolveScheduleDate(seg, context);
    if (batchSchedule?.dates[0]) {
      inheritedTaskDate = batchSchedule.dates[0];
    } else if (dateResolution.hasExplicitDate) {
      inheritedTaskDate = dateResolution.date;
    }
    const taskDate = inheritedTaskDate;

    // 2. Phân tích Giờ bắt đầu (startTime)
    let startTime = '';
    const parsedTime = parseVietnameseTime(seg);

    if (parsedTime) {
      startTime = parsedTime.startTime;
    } else {
      // Phân tích theo buổi trong ngày nếu không có số giờ cụ thể
      const normalizedSegment = normalizeVietnameseText(seg);
      if (/buoi\s*sang|\bsang\b/i.test(normalizedSegment)) {
        startTime = '08:30';
      } else if (/buoi\s*trua|\btrua\b/i.test(normalizedSegment)) {
        startTime = '12:00';
      } else if (/buoi\s*chieu|\bchieu\b/i.test(normalizedSegment)) {
        startTime = '14:30';
      } else if (/buoi\s*toi|\btoi\s+hoc\b/i.test(normalizedSegment)) {
        startTime = '19:30';
      }
    }

    // 3. Phân tích Mức độ ưu tiên (Priority)
    const priority = parsePriority(seg);

    // 4. Trích xuất Tiêu đề sạch sẽ (Clean title)
    let title = cleanTaskTitle(seg, parsedTime?.matchedText);

    // Viết hoa chữ cái đầu
    if (title) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    } else {
      title = `Công việc ${index}`;
    }

    const batchGroupId = batchSchedule && batchSchedule.dates.length > 1
      ? `ai-batch-${Date.now()}-${index}`
      : undefined;
    const taskDates = batchSchedule?.dates.length
      ? batchSchedule.dates
      : [taskDate];

    taskDates.forEach((date, occurrenceIndex) => {
      drafts.push({
        id: `ai-draft-${Date.now()}-${index}-${occurrenceIndex}`,
        title,
        date,
        startTime,
        reminderMinutes: globalReminder,
        priority,
        source: 'direct_request',
        batchGroupId,
        changeStatus: 'unchanged',
      });
    });

    index++;
  }

  return drafts;
}

/** Separate independently timed clauses, keeping conjunctions in titles/attributes. */
export function separateTimedConjunctions(text: string): string {
  const parts = text.split(/\s+(?:và|va)\s+/i);
  let result = parts[0];
  for (const part of parts.slice(1)) {
    const hasOwnTime = parseVietnameseTime(
      replaceVietnameseMatches(part, DURATION_CLAUSE_PATTERN),
    ) !== null;
    const previousHasTime = parseVietnameseTime(result) !== null;
    result += hasOwnTime && previousHasTime && !startsWithTaskAttribute(part)
      ? `;${part}`
      : ` và ${part}`;
  }
  return result;
}

/**
 * Xử lý tinh chỉnh kế hoạch (Refinement / Follow-up modifications)
 */
export function refineVietnameseSchedule(
  currentDrafts: AiDraftTask[],
  instruction: string,
  _context: AiSchedulingContext,
): AiDraftTask[] {
  const originalInstruction = instruction.trim();
  const norm = normalizeVietnameseText(originalInstruction);
  let updated = [...currentDrafts];

  // 0. Trường hợp: Sắp xếp lại / Tối ưu toàn bộ các việc đang xem
  if (isReorderIntent(norm)) {
    const draftsByDate = new Map<string, AiDraftTask[]>();
    for (const task of updated) {
      const tasksForDate = draftsByDate.get(task.date) || [];
      tasksForDate.push({
        ...task,
        startTime: '',
        changeStatus: 'updated' as const,
      });
      draftsByDate.set(task.date, tasksForDate);
    }
    return Array.from(draftsByDate, ([date, tasks]) =>
      autoSlotTasks(tasks, [], date),
    ).flat();
  }

  // 1. Trường hợp: Xóa một công việc (ví dụ: "bỏ việc học tiếng Trung", "xóa họp team")
  if (/\b(?:bo|xoa|huy)\b/.test(norm)) {
    const keywordMatch = norm
      .replace(/^(?:bo|xoa|huy)\s+(?:viec\s+|cong\s+viec\s+)?/, '')
      .trim();
    if (keywordMatch) {
      updated = updated.filter(
        (t) => !normalizeVietnameseText(t.title).includes(keywordMatch),
      );
    }
  }

  // 2. Trường hợp: Đổi nhắc trước cho tất cả (ví dụ: "cho tất cả nhắc 15 phút")
  const reminderAllMatch = norm.match(
    /(?:tat ca|het)\s+(?:nhac|bao)\s*(?:truoc\s*)?(\d+)/,
  );
  if (reminderAllMatch) {
    const val = Number(reminderAllMatch[1]) as ReminderMinutes;
    updated = updated.map((t) => ({
      ...t,
      reminderMinutes: val,
      changeStatus: 'updated',
    }));
  }

  // 3. Trường hợp: Đổi giờ của một công việc cụ thể
  // (ví dụ: "dời báo cáo sang 10h nhé")
  for (let i = 0; i < updated.length; i++) {
    const task = updated[i];
    const taskKeyword = normalizeVietnameseText(task.title);

    // Kiểm tra xem câu lệnh có nhắc đến task này không
    const words = taskKeyword.split(/\s+/);
    const mentionsTask = words.some((w) => w.length > 2 && norm.includes(w));

    if (mentionsTask) {
      let newStart = task.startTime;
      const parsedTime = parseVietnameseTime(originalInstruction, true);
      if (parsedTime) newStart = parsedTime.startTime;

      updated[i] = {
        ...task,
        startTime: newStart,
        changeStatus: 'updated',
      };
    }
  }

  // 4. Trường hợp: Thêm một công việc mới (ví dụ: "thêm gym buổi sáng")
  if (/\bthem\b/.test(norm)) {
    const addMatch = replaceVietnameseMatches(
      originalInstruction,
      /^.*\bthem\s+/,
      '',
    ).trim();
    if (addMatch) {
      const parsedNew = parseVietnameseScheduleText(addMatch, _context);
      if (parsedNew.length > 0) {
        const newTask = {
          ...parsedNew[0],
          changeStatus: 'added' as const,
        };
        updated.push(newTask);
      }
    }
  }

  return updated;
}
