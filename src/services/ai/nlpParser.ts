import type { ReminderMinutes, TaskPriority } from '../../types';
import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import { addDays, fromDateKey, toDateKey } from '../../utils/date';
import { autoSlotTasks } from './slottingEngine';

/**
 * Kiểm tra xem người dùng có đang yêu cầu sắp xếp lại hoặc tối ưu lịch trình hiện có không
 */
export function isReorderIntent(text: string): boolean {
  const norm = text.trim().toLowerCase();
  return (
    /^(?:hãy\s+)?(?:sắp xếp|tối ưu|sắp đặt|phân bổ|tái sắp xếp)\s+(?:lại\s+)?(?:cả\s+ngày|các\s+công\s+việc|công\s+việc|lịch\s+trình|thời\s+gian\s+biểu)/i.test(
      norm,
    ) ||
    /^(?:sắp xếp|tối ưu|phân bổ)\s+(?:cả\s+ngày|công\s+việc|lịch\s+trình)/i.test(norm) ||
    /^(?:sắp xếp|tối ưu)\s+lại\s+/i.test(norm)
  );
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
    const realToday = context.realToday || context.targetDate;
    let targetDayKey = context.targetDate;

    if (/ngày mai|\bmai\b/i.test(normalized)) {
      targetDayKey = toDateKey(addDays(fromDateKey(realToday), 1));
    } else if (/ngày kia|\bmốt\b|ngày mốt/i.test(normalized)) {
      targetDayKey = toDateKey(addDays(fromDateKey(realToday), 2));
    } else if (/hôm nay/i.test(normalized)) {
      targetDayKey = realToday;
    }

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

  for (const seg of rawSegments) {
    if (seg.length < 3) continue;

    // 1. Phân tích Ngày (Date)
    const realToday = context.realToday || context.targetDate;
    let taskDate = context.targetDate;

    if (/ngày mai|\bmai\b/i.test(seg)) {
      taskDate = toDateKey(addDays(fromDateKey(realToday), 1));
    } else if (/ngày kia|\bmốt\b|ngày mốt/i.test(seg)) {
      taskDate = toDateKey(addDays(fromDateKey(realToday), 2));
    } else if (/hôm nay/i.test(seg)) {
      taskDate = realToday;
    } else {
      const weekdayMatch = seg.match(
        /\b(thứ\s+[2-7]|thứ\s+hai|thứ\s+ba|thứ\s+tư|thứ\s+năm|thứ\s+sáu|thứ\s+bảy|chủ\s+nhật)\b/i,
      );
      if (weekdayMatch) {
        const dayStr = weekdayMatch[1].toLowerCase().replace(/\s+/g, ' ');
        const dayMap: Record<string, number> = {
          'chủ nhật': 0,
          'thứ 2': 1,
          'thứ hai': 1,
          'thứ 3': 2,
          'thứ ba': 2,
          'thứ 4': 3,
          'thứ tư': 3,
          'thứ 5': 4,
          'thứ năm': 4,
          'thứ 6': 5,
          'thứ sáu': 5,
          'thứ 7': 6,
          'thứ bảy': 6,
        };
        const targetWeekday = dayMap[dayStr];
        if (targetWeekday !== undefined) {
          const currentDayObj = fromDateKey(realToday);
          const currentWeekday = currentDayObj.getDay();
          let diff = targetWeekday - currentWeekday;
          if (diff <= 0) diff += 7; // Thứ trong tuần tiếp theo
          taskDate = toDateKey(addDays(currentDayObj, diff));
        }
      }
    }

    // 2. Phân tích Giờ bắt đầu (startTime)
    let startTime = '';
    let remainingSeg = seg;
    const timeMatch =
      seg.match(/(?:lúc|vào lúc)?\s*(\d{1,2})[h:](\d{2})?\s*(sáng|chiều|tối)?/i) ||
      seg.match(/(chiều|tối|sáng)\s*(\d{1,2})\s*h(?:(\d{2}))?/i);

    if (timeMatch) {
      let hours: number;
      let minutes: number = 0;
      if (timeMatch[1] && isNaN(Number(timeMatch[1]))) {
        // Định dạng "chiều 2h"
        hours = Number(timeMatch[2]);
        minutes = timeMatch[3] ? Number(timeMatch[3]) : 0;
      } else {
        // Định dạng "9h", "9:30", "14h chiều"
        hours = Number(timeMatch[1]);
        minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
      }

      const isAfternoonOrEvening = /chiều|tối/i.test(seg);
      const isMorning = /sáng/i.test(seg);

      if (hours < 12 && isAfternoonOrEvening) {
        hours += 12;
      } else if (hours === 12 && isMorning) {
        hours = 0;
      }

      startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      remainingSeg = seg.replace(timeMatch[0], ' ');
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
    let title = seg
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
    const draftsToReorder = updated.map((t) => ({
      ...t,
      startTime: '',
      changeStatus: 'updated' as const,
    }));
    return autoSlotTasks(draftsToReorder, [], _context.targetDate);
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
      const newTimeMatch = norm.match(/(?:sang|vào|lúc)\s*(\d{1,2})\s*h(?:(\d{2}))?/i);
      if (newTimeMatch) {
        const h = Number(newTimeMatch[1]);
        const m = newTimeMatch[2] ? Number(newTimeMatch[2]) : 0;
        newStart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }

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
