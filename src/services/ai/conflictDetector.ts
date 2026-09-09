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

const DAY_START = 8 * 60;
const DAY_END = 21 * 60 + 30;
const SLOT_INCREMENT = 15;

function hasSameStartTime(first: string, second: string): boolean {
  const firstMinutes = timeToMinutes(first);
  const secondMinutes = timeToMinutes(second);
  return (
    Number.isFinite(firstMinutes) &&
    Number.isFinite(secondMinutes) &&
    firstMinutes === secondMinutes
  );
}

function findAvailableStart(
  preferredStart: number,
  date: string,
  occupiedTasks: ScheduleConflictTask[],
  excludedStarts: ReadonlySet<number>,
): number | null {
  const roundedStart =
    Math.ceil(Math.max(DAY_START, preferredStart) / SLOT_INCREMENT) *
    SLOT_INCREMENT;

  for (let start = roundedStart; start <= DAY_END; start += SLOT_INCREMENT) {
    if (excludedStarts.has(start)) continue;

    const isAvailable = occupiedTasks.every((task) => {
      if (task.date !== date || !task.startTime) return true;
      const occupiedStart = timeToMinutes(task.startTime);
      return !Number.isFinite(occupiedStart) || occupiedStart !== start;
    });

    if (isAvailable) return start;
  }

  return null;
}

/**
 * Kiểm tra các task theo ngày và giờ bắt đầu. Task hoàn thành và task đang được
 * AI cập nhật (cùng ID với draft) không tham gia phép so sánh.
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
      !draftIds.has(task.id),
  );

  drafts.forEach((draft, draftIndex) => {
    if (!draft.startTime) return;

    for (const existingTask of activeExistingTasks) {
      if (
        existingTask.date === draft.date &&
        hasSameStartTime(existingTask.startTime, draft.startTime)
      ) {
        collisions.push({
          draftTask: draft,
          conflictingTask: {
            id: existingTask.id,
            title: existingTask.title,
            date: existingTask.date,
            startTime: existingTask.startTime,
            origin: 'existing',
          },
        });
      }
    }

    for (let previousIndex = 0; previousIndex < draftIndex; previousIndex += 1) {
      const previousDraft = drafts[previousIndex];
      if (
        previousDraft.date === draft.date &&
        previousDraft.startTime &&
        hasSameStartTime(previousDraft.startTime, draft.startTime)
      ) {
        collisions.push({
          draftTask: draft,
          conflictingTask: {
            id: previousDraft.id,
            title: previousDraft.title,
            date: previousDraft.date,
            startTime: previousDraft.startTime,
            origin: 'draft',
          },
        });
      }
    }
  });

  return { isValid: collisions.length === 0, collisions };
}

/** Phát hiện task có cùng ngày và cùng giờ bắt đầu. */
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
        !draftIds.has(task.id),
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      date: task.date,
      startTime: task.startTime,
      origin: 'existing',
    }));

  return validation.collisions.map(({ draftTask, conflictingTask }) => {
    const occupiedTasks: ScheduleConflictTask[] = [
      ...activeExistingTasks,
      ...drafts
        .filter(
          (candidate) =>
            candidate.id !== draftTask.id && Boolean(candidate.startTime),
        )
        .map((candidate) => ({
          id: candidate.id,
          title: candidate.title,
          date: candidate.date,
          startTime: candidate.startTime,
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
      draftTime: draftTask.startTime,
      conflictingTask,
      suggestedSlots,
      selectedSlotId: suggestedSlots[0]?.id ?? '',
    };
  });
}

/** Sinh tối đa hai giờ bắt đầu chưa được sử dụng trong ngày. */
export function generateSuggestedSlots(
  draft: AiDraftTask,
  conflictingTask: ScheduleConflictTask,
  occupiedTasks: ScheduleConflictTask[],
): ConflictSlotOption[] {
  const options: ConflictSlotOption[] = [];
  const conflictStart = timeToMinutes(conflictingTask.startTime);
  const usedStarts = new Set<number>();
  const candidatePlans = [
    {
      id: 'slot_after_conflict',
      preferredStart: conflictStart + SLOT_INCREMENT,
      label: `Sau ${conflictingTask.title}`,
      fallbackLabel: 'Giờ trống tiếp theo',
      tag: 'Gợi ý',
    },
    {
      id: 'slot_afternoon',
      preferredStart: 13 * 60 + 30,
      label: 'Sau bữa trưa',
      fallbackLabel: 'Giờ trống buổi chiều',
    },
    {
      id: 'slot_next_available',
      preferredStart: DAY_START,
      label: 'Giờ trống khác',
      fallbackLabel: 'Giờ trống khác',
    },
  ];

  for (const candidate of candidatePlans) {
    if (options.length >= 2) break;

    const availableStart = findAvailableStart(
      candidate.preferredStart,
      draft.date,
      occupiedTasks,
      usedStarts,
    );
    if (availableStart === null) continue;

    usedStarts.add(availableStart);
    options.push({
      id: candidate.id,
      startTime: minutesToTime(availableStart),
      label:
        availableStart === candidate.preferredStart
          ? candidate.label
          : candidate.fallbackLabel,
      tag: candidate.tag,
    });
  }

  return options;
}
