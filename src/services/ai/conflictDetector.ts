import type { Task } from '../../types';
import type {
  AiDraftTask,
  ConflictSlotOption,
  ScheduleConflict,
  ScheduleConflictTask,
} from '../../types/ai';
import { minutesToTime, timeToMinutes } from '../../utils/date';

export interface ScheduleCollision {
  draftTask: AiDraftTask;
  conflictingTask: ScheduleConflictTask;
}

export interface ScheduleValidationResult {
  isValid: boolean;
  collisions: ScheduleCollision[];
}

function overlaps(
  firstStart: number,
  firstDuration: number,
  secondStart: number,
  secondDuration: number,
): boolean {
  return (
    firstStart < secondStart + secondDuration &&
    firstStart + firstDuration > secondStart
  );
}

const DAY_START = 8 * 60;
const DAY_END = 21 * 60 + 30;
const SLOT_INCREMENT = 15;

function findAvailableStart(
  preferredStart: number,
  duration: number,
  date: string,
  occupiedTasks: ScheduleConflictTask[],
  excludedStarts: ReadonlySet<number>,
): number | null {
  const roundedStart =
    Math.ceil(Math.max(DAY_START, preferredStart) / SLOT_INCREMENT) *
    SLOT_INCREMENT;

  for (
    let start = roundedStart;
    start + duration <= DAY_END;
    start += SLOT_INCREMENT
  ) {
    if (excludedStarts.has(start)) continue;

    const isAvailable = occupiedTasks.every((task) => {
      if (task.date !== date || !task.startTime || task.durationMinutes <= 0) {
        return true;
      }

      const occupiedStart = timeToMinutes(task.startTime);
      return (
        !Number.isFinite(occupiedStart) ||
        !overlaps(start, duration, occupiedStart, task.durationMinutes)
      );
    });

    if (isAvailable) return start;
  }

  return null;
}

/**
 * Kiểm tra tính hợp lệ của lịch theo từng ngày.
 *
 * Mỗi draft được so sánh với task đã lưu và các draft đứng
 * trước nó. Task đã lưu có cùng ID với draft bị loại khỏi
 * phép so sánh vì draft đó là phiên bản cập nhật khi reorder.
 */
export function validateScheduleByDate(
  drafts: AiDraftTask[],
  existingTasks: Task[],
): ScheduleValidationResult {
  const collisions: ScheduleCollision[] = [];
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const activeExistingTasks = existingTasks.filter(
    (task) =>
      !task.completed &&
      Boolean(task.startTime) &&
      task.durationMinutes > 0 &&
      !draftIds.has(task.id),
  );

  drafts.forEach((draft, draftIndex) => {
    if (!draft.startTime || draft.durationMinutes <= 0) return;

    const draftStart = timeToMinutes(draft.startTime);
    if (!Number.isFinite(draftStart)) return;

    for (const existingTask of activeExistingTasks) {
      if (existingTask.date !== draft.date) continue;

      const existingStart = timeToMinutes(existingTask.startTime);
      if (
        Number.isFinite(existingStart) &&
        overlaps(
          draftStart,
          draft.durationMinutes,
          existingStart,
          existingTask.durationMinutes,
        )
      ) {
        collisions.push({
          draftTask: draft,
          conflictingTask: {
            id: existingTask.id,
            title: existingTask.title,
            date: existingTask.date,
            startTime: existingTask.startTime,
            durationMinutes: existingTask.durationMinutes,
            origin: 'existing',
          },
        });
      }
    }

    for (let previousIndex = 0; previousIndex < draftIndex; previousIndex += 1) {
      const previousDraft = drafts[previousIndex];
      if (
        previousDraft.date !== draft.date ||
        !previousDraft.startTime ||
        previousDraft.durationMinutes <= 0
      ) {
        continue;
      }

      const previousStart = timeToMinutes(previousDraft.startTime);
      if (
        Number.isFinite(previousStart) &&
        overlaps(
          draftStart,
          draft.durationMinutes,
          previousStart,
          previousDraft.durationMinutes,
        )
      ) {
        collisions.push({
          draftTask: draft,
          conflictingTask: {
            id: previousDraft.id,
            title: previousDraft.title,
            date: previousDraft.date,
            startTime: previousDraft.startTime,
            durationMinutes: previousDraft.durationMinutes,
            origin: 'draft',
          },
        });
      }
    }
  });

  return { isValid: collisions.length === 0, collisions };
}

/**
 * Phát hiện xung đột trùng giờ giữa danh sách task AI đề xuất và các task sẵn có
 */
export function detectConflicts(
  drafts: AiDraftTask[],
  existingTasks: Task[],
): ScheduleConflict[] {
  const validation = validateScheduleByDate(drafts, existingTasks);
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const activeExistingTasks: ScheduleConflictTask[] = existingTasks
    .filter(
      (task) =>
        !task.completed &&
        Boolean(task.startTime) &&
        task.durationMinutes > 0 &&
        !draftIds.has(task.id),
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      date: task.date,
      startTime: task.startTime,
      durationMinutes: task.durationMinutes,
      origin: 'existing',
    }));

  return validation.collisions.map(({ draftTask, conflictingTask }) => {
    const draftStart = timeToMinutes(draftTask.startTime);
    const occupiedTasks: ScheduleConflictTask[] = [
      ...activeExistingTasks,
      ...drafts
        .filter(
          (candidate) =>
            candidate.id !== draftTask.id &&
            Boolean(candidate.startTime) &&
            candidate.durationMinutes > 0,
        )
        .map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          date: candidate.date,
          startTime: candidate.startTime,
          durationMinutes: candidate.durationMinutes,
          origin: 'draft' as const,
        })),
    ];
    const suggestedSlots = generateSuggestedSlots(
      draftTask,
      conflictingTask,
      occupiedTasks,
    );

    return {
      draftTaskId: draftTask.id,
      draftTaskTitle: draftTask.title,
      draftRange: {
        startTime: draftTask.startTime,
        endTime: minutesToTime(draftStart + draftTask.durationMinutes),
      },
      conflictingTask,
      suggestedSlots,
      selectedSlotId: suggestedSlots[0]?.id || 'keep_original',
    };
  });
}

/**
 * Sinh các khung giờ gợi ý thay thế thông minh khi bị trùng
 */
export function generateSuggestedSlots(
  draft: AiDraftTask,
  conflictingTask: ScheduleConflictTask,
  occupiedTasks: ScheduleConflictTask[],
): ConflictSlotOption[] {
  const options: ConflictSlotOption[] = [];
  const duration = draft.durationMinutes;
  const conflictingEnd = timeToMinutes(conflictingTask.startTime) + conflictingTask.durationMinutes;

  const usedStarts = new Set<number>();
  const candidatePlans = [
    {
      id: 'slot_after_conflict',
      preferredStart: conflictingEnd + 15,
      label: `Sau khi kết thúc ${conflictingTask.title}`,
      fallbackLabel: 'Khung giờ trống tiếp theo',
      tag: 'Gợi ý',
    },
    {
      id: 'slot_afternoon',
      preferredStart: 13 * 60 + 30,
      label: 'Sau bữa trưa',
      fallbackLabel: 'Khung giờ trống buổi chiều',
    },
    {
      id: 'slot_next_available',
      preferredStart: DAY_START,
      label: 'Khung giờ trống khác',
      fallbackLabel: 'Khung giờ trống khác',
    },
  ];

  for (const candidate of candidatePlans) {
    if (options.length >= 2) break;

    const availableStart = findAvailableStart(
      candidate.preferredStart,
      duration,
      draft.date,
      occupiedTasks,
      usedStarts,
    );
    if (availableStart === null || usedStarts.has(availableStart)) continue;

    usedStarts.add(availableStart);
    options.push({
      id: candidate.id,
      startTime: minutesToTime(availableStart),
      endTime: minutesToTime(availableStart + duration),
      label:
        availableStart === candidate.preferredStart
          ? candidate.label
          : candidate.fallbackLabel,
      tag: candidate.tag,
    });
  }

  // Gợi ý 3: Giữ nguyên để người dùng tự xử lý
  const draftStart = timeToMinutes(draft.startTime);
  options.push({
    id: 'keep_original',
    startTime: draft.startTime,
    endTime: minutesToTime(draftStart + duration),
    label: 'Giữ nguyên',
    isKeepOriginal: true,
  });

  return options;
}
