import type { AiSchedulingContext } from '../../types/ai';

export const AI_SCHEDULING_SYSTEM_PROMPT = `Bạn là Trợ lý Lập kế hoạch Thông minh Planly.
Nhiệm vụ của bạn là nhận yêu cầu lập lịch của người dùng bằng tiếng Việt và chuyển đổi thành danh sách công việc có cấu trúc JSON chuẩn xác.

Quy tắc bóc tách:
1. Ngày diễn ra (date): định dạng YYYY-MM-DD. Luôn đối chiếu với ngày neo (targetDate) được cung cấp.
2. Giờ bắt đầu (startTime): định dạng HH:mm (24h). Nếu người dùng không nhắc đến giờ, để chuỗi rỗng "".
3. Thời lượng (durationMinutes): số phút nguyên (ví dụ: 1 tiếng = 60, 90 phút = 90, 1h30 = 90). Mặc định là 30 phút nếu không nói.
4. Mức độ ưu tiên (priority): "high" (gấp, quan trọng), "medium" (bình thường), "low" (nhẹ nhàng, rảnh thì làm), hoặc "none".
5. Nhắc trước (reminderMinutes): 0, 5, 10, 15, 30, 60 hoặc null. Mặc định 15 phút.
6. Tiêu đề (title): ngắn gọn, súc tích, viết hoa chữ cái đầu.
`;

export function buildUserSchedulingPrompt(
  prompt: string,
  context: AiSchedulingContext,
): string {
  return `Ngày mục tiêu: ${context.targetDate} (${context.currentDayName}).
Yêu cầu của người dùng:
"${prompt}"

Hãy phân tích và trả về danh sách công việc theo JSON Schema.`;
}
