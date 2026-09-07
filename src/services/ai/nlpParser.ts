import type { ReminderMinutes, TaskPriority } from '../../types';
import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import {
  resolveScheduleDate,
  stripScheduleDateReferences,
} from './dateIntent';
import { isReorderIntent } from './scheduleIntent';
import { autoSlotTasks } from './slottingEngine';
import { resolveExistingTaskUpdate } from './taskUpdateIntent';
import { parseVietnameseTime } from './timeIntent';

export { isReorderIntent } from './scheduleIntent';

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
      durationMinutes: t.durationMinutes || 30,
      reminderMinutes: t.reminderMinutes ?? 15,
      priority: t.priority || 'none',
      source: 'auto_slotted',
      changeStatus: 'updated',
    }));

    return autoSlotTasks(draftsToReorder, [], targetDayKey);
  }

  const existingTaskUpdate = resolveExistingTaskUpdate(normalized, context);
  if (existingTaskUpdate !== null) return existingTaskUpdate;

  // 1. Tìm reminder chung nếu có (ví dụ: "nhắc tôi trước 30p nhé", "báo trước 15 phút")
  let globalReminder: ReminderMinutes = 15;
  const reminderPattern =
    /(?:nhắc|báo)\s+(?:(?:cho\s+)?(?:tôi|mình|em)\s+)?(?:trước\s+)?(\d+)\s*(?:phút|p|giờ|g)?(?:\s*(?:nhé|nha|giúp|với))?/gi;
  const reminderMatches = Array.from(normalized.matchAll(reminderPattern));
  if (reminderMatches.length > 0) {
    const lastMatch = reminderMatches[reminderMatches.length - 1];
    const num = Number(lastMatch[1]);
    if ([0, 5, 10, 15, 30, 60].includes(num)) {
      globalReminder = num as ReminderMinutes;
    }
  }

  // Loại bỏ câu mở đầu chung nếu có (ví dụ: "tạo giúp tôi 1 lịch trình 3 việc, ...", "lên lịch giúp tôi: ...")
  const strippedIntro = normalized
    .replace(
      /^(?:tạo|lên|hãy lên|lập)\s+(?:giúp\s+(?:tôi|mình)\s+)?(?:1\s+)?(?:lịch\s+trình|kế\s+hoạch)\s*(?:\d+\s*việc)?\s*[,:]?\s*/i,
      '',
    )
    .trim();

  // Loại bỏ toàn bộ các mệnh đề nhắc nhở trước khi tách việc để không bị cắt nhầm thành task riêng
  const cleanNormalized = strippedIntro.replace(reminderPattern, '').trim();

  // Tách văn bản thành các câu hoặc mệnh đề công việc
  // Dấu phân cách lớn: xuống dòng, dấu chấm phẩy, từ nối hành động ("sau đó", "tiếp theo", "xong rồi", "rồi")
  const baseSegments = cleanNormalized
    .split(/[\n;]|(?:\s+(?:sau đó|tiếp theo|xong rồi|rồi)\s+)/i)
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
        const hasTime =
          /(?:\d{1,2}[h:]|\b(?:sáng|chiều|tối)\s*\d{1,2}|\b(?:buổi\s*)?(?:sáng|trưa|chiều|tối)\b|\btôi\s+học\b)/i.test(
            p,
          );
        if (hasTime) {
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
    const dateResolution = resolveScheduleDate(seg, context);
    if (dateResolution.hasExplicitDate) {
      inheritedTaskDate = dateResolution.date;
    }
    const taskDate = inheritedTaskDate;

    // 2. Phân tích Giờ bắt đầu (startTime)
    let startTime = '';
    let remainingSeg = seg;
    const parsedTime = parseVietnameseTime(seg);

    if (parsedTime) {
      startTime = parsedTime.startTime;
      remainingSeg = seg.replace(parsedTime.matchedText, ' ');
    } else {
      // Phân tích theo buổi trong ngày nếu không có số giờ cụ thể
      if (/buổi\s*sáng|\bsáng\b/i.test(seg)) {
        startTime = '08:30';
      } else if (/buổi\s*trưa|\btrưa\b/i.test(seg)) {
        startTime = '12:00';
      } else if (/buổi\s*chiều|\bchiều\b/i.test(seg)) {
        startTime = '14:30';
      } else if (/buổi\s*tối|\btối\b|\btôi\s+học\b/i.test(seg)) {
        startTime = '19:30';
      }
    }

    // 3. Phân tích Thời lượng (Duration in minutes)
    let durationMinutes = 30; // Mặc định 30 phút
    if (/1\s*tiếng\s*rưỡi|1\s*giờ\s*rưỡi/i.test(remainingSeg)) {
      durationMinutes = 90;
    } else if (/2\s*tiếng\s*rưỡi|2\s*giờ\s*rưỡi/i.test(remainingSeg)) {
      durationMinutes = 150;
    } else {
      const durHourMatch = remainingSeg.match(/(\d+)\s*(?:tiếng|giờ)/i);
      const durMinMatch = remainingSeg.match(/(\d+)\s*(?:phút|p\b)/i);

      if (durHourMatch && durMinMatch) {
        durationMinutes = Number(durHourMatch[1]) * 60 + Number(durMinMatch[1]);
      } else if (durHourMatch) {
        durationMinutes = Number(durHourMatch[1]) * 60;
      } else if (durMinMatch) {
        durationMinutes = Number(durMinMatch[1]);
      }
    }

    // 4. Phân tích Mức độ ưu tiên (Priority)
    let priority: TaskPriority = 'none';
    if (/gấp|khẩn cấp|rất quan trọng|ưu tiên cao|hàng đầu/i.test(seg)) {
      priority = 'high';
    } else if (/quan trọng|vừa|ưu tiên vừa/i.test(seg)) {
      priority = 'medium';
    } else if (/thấp|rảnh thì làm|không gấp/i.test(seg)) {
      priority = 'low';
    }

    // 5. Trích xuất Tiêu đề sạch sẽ (Clean title)
    let title = stripScheduleDateReferences(seg)
      .replace(
        /^(?:tôi muốn|hãy giúp tôi|lên lịch giúp|tạo|tôi cần|cần|phải|hãy)\s+(?:1\s+)?(?:cuộc\s+hẹn\s+|lịch\s+hẹn\s+|việc\s+|công việc\s+)?/i,
        '',
      )
      .replace(/^(?:mai|hôm nay|ngày mai|chiều|tối|sáng)\s+/i, '')
      .replace(/(?:lúc|vào lúc)?\s*\d{1,2}[h:]\d{0,2}\s*(?:sáng|chiều|tối)?/i, '')
      .replace(/(?:chiều|tối|sáng)\s*\d{1,2}\s*h\d{0,2}/i, '')
      .replace(/\b(?:hôm nay|ngày mai|chiều nay|tối nay|sáng nay|nay)\b/gi, '')
      .replace(/(?:vào\s+)?(?:buổi\s*sáng|buổi\s*trưa|buổi\s*chiều|buổi\s*tối)/gi, '')
      .replace(/\b(?:buổi\s+)?(?:sáng|chiều|tối|trưa)\b/gi, '')
      .replace(/^tôi\s+(?:học|làm|đi)\b/i, (m) => m.replace(/^tôi\s+/i, ''))
      .replace(/\d+\s*(?:tiếng|giờ|phút|p)\b\s*rưỡi?/gi, '')
      .replace(/1\s*tiếng\s*rưỡi|1\s*giờ\s*rưỡi/gi, '')
      .replace(/(?:ưu tiên|mức)\s*(?:cao|vừa|thấp|gấp)/gi, '')
      .replace(/(?:nhắc|báo)\s*(?:trước\s*)?\d+\s*(?:phút|p)?/gi, '')
      .replace(/^(?:làm|cần|phải|hãy)\s+/i, '')
      .replace(/^(?:1\s+)?(?:cuộc\s+hẹn\s+|lịch\s+hẹn\s+)/i, '')
      .trim();

    // Viết hoa chữ cái đầu
    if (title) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    } else {
      title = `Công việc ${index}`;
    }

    drafts.push({
      id: `ai-draft-${Date.now()}-${index}`,
      title,
      date: taskDate,
      startTime,
      durationMinutes,
      reminderMinutes: globalReminder,
      priority,
      source: 'direct_request',
      changeStatus: 'unchanged',
    });

    index++;
  }

  return drafts;
}

/**
 * Xử lý tinh chỉnh kế hoạch (Refinement / Follow-up modifications)
 */
export function refineVietnameseSchedule(
  currentDrafts: AiDraftTask[],
  instruction: string,
  _context: AiSchedulingContext,
): AiDraftTask[] {
  const norm = instruction.trim().toLowerCase();
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
  if (/bỏ|xóa|hủy/i.test(norm)) {
    const keywordMatch = norm.replace(/^(?:bỏ|xóa|hủy)\s+(?:việc\s+|công việc\s+)?/i, '').trim();
    if (keywordMatch) {
      updated = updated.filter(
        (t) => !t.title.toLowerCase().includes(keywordMatch),
      );
    }
  }

  // 2. Trường hợp: Đổi nhắc trước cho tất cả (ví dụ: "cho tất cả nhắc 15 phút")
  const reminderAllMatch = norm.match(/(?:tất cả|hết)\s+(?:nhắc|báo)\s*(?:trước\s*)?(\d+)/i);
  if (reminderAllMatch) {
    const val = Number(reminderAllMatch[1]) as ReminderMinutes;
    updated = updated.map((t) => ({
      ...t,
      reminderMinutes: val,
      changeStatus: 'updated',
    }));
  }

  // 3. Trường hợp: Đổi giờ hoặc thời lượng của một công việc cụ thể
  // (ví dụ: "dời báo cáo sang 10h và thành 2 tiếng nhé")
  for (let i = 0; i < updated.length; i++) {
    const task = updated[i];
    const taskKeyword = task.title.toLowerCase();

    // Kiểm tra xem câu lệnh có nhắc đến task này không
    const words = taskKeyword.split(/\s+/);
    const mentionsTask = words.some((w) => w.length > 2 && norm.includes(w));

    if (mentionsTask) {
      let newStart = task.startTime;
      let newDur = task.durationMinutes;

      // Tìm giờ mới
      const parsedTime = parseVietnameseTime(norm, true);
      if (parsedTime) newStart = parsedTime.startTime;

      // Tìm thời lượng mới
      const newDurMatch = norm.match(/(?:thành|làm)\s*(\d+)\s*(?:tiếng|giờ)/i);
      if (newDurMatch) {
        newDur = Number(newDurMatch[1]) * 60;
      }

      updated[i] = {
        ...task,
        startTime: newStart,
        durationMinutes: newDur,
        changeStatus: 'updated',
      };
    }
  }

  // 4. Trường hợp: Thêm một công việc mới (ví dụ: "thêm 1 tiếng gym buổi sáng")
  if (/thêm/i.test(norm)) {
    const addMatch = norm.replace(/^.*thêm\s+/i, '').trim();
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
