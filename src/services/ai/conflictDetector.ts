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
const EMPTY_OCCUPIED_STARTS: ReadonlySet<number> = new Set();

function scheduleSlotKey(
  date: string,
  startTime: string,
): string | undefined {
  const start = timeToMinutes(startTime);
  return Number.isFinite(start) ? `${date}\u0000${start}` : undefined;
}

function addOccupiedTask(
  occupiedBySlot: Map<string, ScheduleConflictTask[]>,
  key: string,
  task: ScheduleConflictTask,
): void {
  const occupied = occupiedBySlot.get(key);
  if (occupied) occupied.push(task);
  else occupiedBySlot.set(key, [task]);
}

function occupiedStartsForDate(
  date: string,
  tasks: ScheduleConflictTask[],
): Set<number> {
  const occupiedStarts = new Set<number>();
  for (const task of tasks) {
    if (task.date !== date || !task.startTime) continue;
    const start = timeToMinutes(task.startTime);
    if (Number.isFinite(start)) occupiedStarts.add(start);
  }
  return occupiedStarts;
}

function findAvailableStart(
  preferredStart: number,
  occupiedStarts: ReadonlySet<number>,
  excludedStarts: ReadonlySet<number>,
): number | null {
  const roundedStart =
    Math.ceil(Math.max(DAY_START, preferredStart) / SLOT_INCREMENT) *
    SLOT_INCREMENT;

  for (let start = roundedStart; start <= DAY_END; start += SLOT_INCREMENT) {
    if (!excludedStarts.has(start) && !occupiedStarts.has(start)) return start;
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
  const occupiedBySlot = new Map<string, ScheduleConflictTask[]>();

  for (const task of existingTasks) {
    if (task.completed || !task.startTime || draftIds.has(task.id)) continue;
    const key = scheduleSlotKey(task.date, task.startTime);
    if (!key) continue;
    addOccupiedTask(occupiedBySlot, key, {
      id: task.id,
      title: task.title,
      date: task.date,
      startTime: task.startTime,
      origin: 'existing',
    });
  }

  for (const draft of drafts) {
    if (!draft.startTime) continue;
    const key = scheduleSlotKey(draft.date, draft.startTime);
    if (!key) continue;

    for (const conflictingTask of occupiedBySlot.get(key) ?? []) {
      collisions.push({ draftTask: draft, conflictingTask });
    }

    addOccupiedTask(occupiedBySlot, key, {
      id: draft.id,
      title: draft.title,
      date: draft.date,
      startTime: draft.startTime,
      origin: 'draft',
    });
  }

  return { isValid: collisions.length === 0, collisions };
}

/** Phát hiện task có cùng ngày và cùng giờ bắt đầu. */
export function detectConflicts(
  drafts: AiDraftTask[],
  existingTasks: Task[],
): ScheduleConflict[] {
  const validation = validateScheduleByDate(drafts, existingTasks);
  const draftIds = new Set(drafts.map((draft) => draft.id));
  const occupiedStartsByDate = new Map<string, Set<number>>();
  const addOccupiedStart = (date: string, startTime: string) => {
    const start = timeToMinutes(startTime);
    if (!Number.isFinite(start)) return;
    const occupiedStarts = occupiedStartsByDate.get(date);
    if (occupiedStarts) occupiedStarts.add(start);
    else occupiedStartsByDate.set(date, new Set([start]));
  };

  for (const task of existingTasks) {
    if (task.completed || !task.startTime || draftIds.has(task.id)) continue;
    addOccupiedStart(task.date, task.startTime);
  }
  for (const draft of drafts) {
    if (draft.startTime) addOccupiedStart(draft.date, draft.startTime);
  }

  return validation.collisions.map(({ draftTask, conflictingTask }) => {
    const suggestedSlots = generateSuggestedSlotsFromOccupied(
      conflictingTask,
      occupiedStartsByDate.get(draftTask.date) ?? EMPTY_OCCUPIED_STARTS,
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
  return generateSuggestedSlotsFromOccupied(
    conflictingTask,
    occupiedStartsForDate(draft.date, occupiedTasks),
  );
}

function generateSuggestedSlotsFromOccupied(
  conflictingTask: ScheduleConflictTask,
  occupiedStarts: ReadonlySet<number>,
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
      occupiedStarts,
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
