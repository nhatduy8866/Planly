import type { ReminderMinutes, Task, TaskPriority } from './index';

/**
 * Các trạng thái của luồng Planly AI trước khi lưu vào lịch.
 */
export type AiModalStep =
  | 'menu_action_sheet'   // Màn 2: Menu từ nút +
  | 'input_prompt'        // Màn 3: Nhập yêu cầu (text/voice)
  | 'analyzing'           // Màn 4: AI phân tích & checklist
  | 'draft_preview'       // Màn 5: Xem trước kế hoạch
  | 'refinement_chat'     // Màn 6: Chỉnh sửa bằng AI
  | 'updated_preview'     // Màn 7: Kế hoạch đã cập nhật
  | 'auto_slotting'       // Tự động sắp xếp khi thiếu giờ
  | 'conflict_resolution'; // Xử lý xung đột trùng lịch

/**
 * Task dự thảo do AI tạo ra (ở trạng thái Preview, chưa lưu vào Database)
 */
export interface AiDraftTask {
  id: string; // UUID tạm thời để định danh trong danh sách preview
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm hoặc rỗng nếu chưa có giờ
  reminderMinutes: ReminderMinutes;
  priority: TaskPriority;
  color?: string;
  source: 'direct_request' | 'auto_slotted' | 'conflict_resolved';
  batchGroupId?: string;
  slottingStatus?: 'scheduled' | 'unscheduled';
  changeStatus?: 'unchanged' | 'updated' | 'added';
}

/**
 * Lựa chọn giờ bắt đầu thay thế khi phát hiện trùng lịch
 */
export interface ConflictSlotOption {
  id: string;
  startTime: string;
  label: string;
  tag?: string; // Ví dụ: "Gợi ý"
}

/**
 * Công việc có cùng giờ bắt đầu và gây xung đột.
 * Có thể là task đã lưu hoặc một draft khác trong cùng kế hoạch AI.
 */
export interface ScheduleConflictTask {
  id: string;
  title: string;
  date: string;
  startTime: string;
  origin: 'existing' | 'draft';
}

/**
 * Thông tin xung đột lịch được phát hiện
 */
export interface ScheduleConflict {
  draftTaskId: string;
  draftTaskTitle: string;
  draftTime: string;
  conflictingTask: ScheduleConflictTask;
  suggestedSlots: ConflictSlotOption[];
  selectedSlotId: string; // Slot đang được chọn (mặc định là slot gợi ý đầu tiên)
}

/**
 * Ngữ cảnh gửi vào cho AI xử lý
 */
export interface AiSchedulingContext {
  realToday?: string; // Ngày thực tế hôm nay của thiết bị (YYYY-MM-DD), ví dụ: "2026-09-07"
  realTodayDayName?: string; // Tên thứ ngày thực tế, ví dụ: "Thứ Hai, 7 tháng 9 năm 2026"
  targetDate: string; // Ngày người dùng đang xem trên màn hình (YYYY-MM-DD)
  currentDayName: string; // Ví dụ: "Thứ Hai, 7 tháng 9 năm 2026"
  existingTasks: Task[]; // Các task đã có trong ngày đó để tránh trùng giờ
  allTasks?: Task[]; // Toàn bộ task trong planner để tra cứu khi câu lệnh nhắm tới ngày khác
}

/**
 * Cấu trúc gợi ý nhanh (Quick Prompts)
 */
export interface AiQuickPrompt {
  id: string;
  icon: string;
  label: string;
  promptText: string;
}
