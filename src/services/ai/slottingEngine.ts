import type { Task, TaskPriority } from '../../types';
import type { AiDraftTask } from '../../types/ai';
import { minutesToTime, timeToMinutes } from '../../utils/date';

interface TimeWindow {
  start: number; // Phút từ 0:00
  end: number;
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

/**
 * Tự động tìm khoảng trống trong ngày và gán giờ bắt đầu hợp lý cho các task chưa có giờ
 */
export function autoSlotTasks(
  drafts: AiDraftTask[],
  existingTasks: Task[],
  targetDate: string,
): AiDraftTask[] {
  // Lấy các task đã có giờ trong ngày
  const scheduledTasks = existingTasks
    .filter((t) => t.date === targetDate && !t.completed && Boolean(t.startTime))
    .map((t) => ({
      start: timeToMinutes(t.startTime),
      end: timeToMinutes(t.startTime) + t.durationMinutes,
    }))
    .sort((a, b) => a.start - b.start);

  // Thêm cả các draft đã có giờ sẵn
  for (const draft of drafts) {
    if (draft.startTime && draft.durationMinutes > 0) {
      const s = timeToMinutes(draft.startTime);
      scheduledTasks.push({ start: s, end: s + draft.durationMinutes });
    }
  }
  scheduledTasks.sort((a, b) => a.start - b.start);

  // Danh sách các khoảng trống trong ngày (khung làm việc từ 08:00 đến 21:30)
  const DAY_START = 8 * 60; // 08:00
  const DAY_END = 21 * 60 + 30; // 21:30

  // Tách các task đã có giờ và task cần xếp giờ (xếp theo độ ưu tiên: Cao -> Vừa -> Thấp)
  const withTime = drafts.filter((d) => Boolean(d.startTime));
  const unscheduled = drafts
    .filter((d) => !d.startTime)
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);

  const result: AiDraftTask[] = [...withTime];
  const occupiedWindows = [...scheduledTasks];

  for (const draft of unscheduled) {
    // Tìm khung giờ trống phù hợp
    const duration = draft.durationMinutes || 30;
    const slot = findBestSlot(
      occupiedWindows,
      duration,
      draft.priority,
      draft.title,
      DAY_START,
      DAY_END,
    );

    if (slot !== null) {
      occupiedWindows.push({ start: slot, end: slot + duration });
      occupiedWindows.sort((a, b) => a.start - b.start);

      result.push({
        ...draft,
        startTime: minutesToTime(slot),
        source: 'auto_slotted',
        slottingStatus: 'scheduled',
      });
    } else {
      // Không tự gán một giờ mặc định vì có thể tạo lịch trùng.
      // Giữ task ở trạng thái chưa xếp để UI yêu cầu người dùng
      // điều chỉnh kế hoạch thay vì lưu một kết quả không hợp lệ.
      result.push({
        ...draft,
        startTime: '',
        slottingStatus: 'unscheduled',
      });
    }
  }

  return result;
}

/**
 * Tìm vị trí trống tối ưu nhất dựa theo từ khóa buổi và mức ưu tiên
 */
function findBestSlot(
  occupied: TimeWindow[],
  duration: number,
  priority: TaskPriority,
  titleHint: string,
  dayStart: number,
  dayEnd: number,
): number | null {
  // Tìm tất cả các khoảng trống (gaps)
  const gaps: TimeWindow[] = [];
  let currentPointer = dayStart;

  for (const block of occupied) {
    if (block.start > currentPointer) {
      gaps.push({ start: currentPointer, end: Math.min(block.start, dayEnd) });
    }
    currentPointer = Math.max(currentPointer, block.end);
  }

  if (currentPointer < dayEnd) {
    gaps.push({ start: currentPointer, end: dayEnd });
  }

  // Lọc các gap có độ dài >= duration
  const validGaps = gaps.filter((g) => g.end - g.start >= duration);
  if (!validGaps.length) return null;

  const titleLower = titleHint.toLowerCase();
  const NOON = 12 * 60;
  const AFTERNOON = 13 * 60 + 30; // 13:30
  const EVENING = 18 * 60 + 30; // 18:30

  // 1. Kiểm tra từ khóa gợi ý buổi trong tiêu đề
  if (/chiều|buổi chiều/i.test(titleLower)) {
    const afternoonGap = validGaps.find((g) => g.start >= AFTERNOON && g.start < EVENING);
    if (afternoonGap) return Math.max(afternoonGap.start, 14 * 60 + 30);
    const anyAfternoon = validGaps.find((g) => g.start >= AFTERNOON);
    if (anyAfternoon) return anyAfternoon.start;
  } else if (/tối|buổi tối/i.test(titleLower)) {
    const eveningGap = validGaps.find((g) => g.start >= EVENING);
    if (eveningGap) return Math.max(eveningGap.start, 19 * 60 + 30);
    const anyLate = validGaps.find((g) => g.start >= 17 * 60);
    if (anyLate) return anyLate.start;
  } else if (/trưa|buổi trưa/i.test(titleLower)) {
    const noonGap = validGaps.find((g) => g.start >= NOON && g.start < AFTERNOON);
    if (noonGap) return noonGap.start;
  } else if (/sáng|buổi sáng/i.test(titleLower)) {
    const morningGap = validGaps.find((g) => g.start < NOON);
    if (morningGap) return morningGap.start;
  }

  // 2. Chiến lược xếp theo mức ưu tiên:
  // - Cao (high): Thích hợp sáng sớm (08:00 - 11:30)
  // - Vừa (medium): Thích hợp đầu chiều (13:30 - 17:00)
  // - Thấp (low/none): Thích hợp cuối chiều hoặc tối (17:00 - 21:00)
  if (priority === 'high') {
    const morningGap = validGaps.find((g) => g.start < NOON);
    if (morningGap) return morningGap.start;
  } else if (priority === 'medium') {
    const afternoonInside = validGaps.find(
      (g) => g.start <= AFTERNOON && g.end >= AFTERNOON + duration,
    );
    if (afternoonInside) return AFTERNOON;

    const afternoonGap = validGaps.find((g) => g.start >= AFTERNOON);
    if (afternoonGap) return afternoonGap.start;
  }

  // Mặc định chọn gap đầu tiên có sẵn
  return validGaps[0].start;
}
