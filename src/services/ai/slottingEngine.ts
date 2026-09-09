import type { Task, TaskPriority } from '../../types';
import type { AiDraftTask } from '../../types/ai';
import { minutesToTime, timeToMinutes } from '../../utils/date';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

const DAY_START = 8 * 60;
const DAY_END = 21 * 60 + 30;
const SLOT_INCREMENT = 15;

/**
 * Gán một giờ bắt đầu chưa được sử dụng cho các task còn thiếu giờ.
 */
export function autoSlotTasks(
  drafts: AiDraftTask[],
  existingTasks: Task[],
  targetDate: string,
): AiDraftTask[] {
  const occupiedStartsByDate = new Map<string, Set<number>>();
  const getOccupiedStarts = (date: string) => {
    const existing = occupiedStartsByDate.get(date);
    if (existing) return existing;
    const created = new Set<number>();
    occupiedStartsByDate.set(date, created);
    return created;
  };

  for (const task of existingTasks) {
    if (task.completed || !task.startTime) continue;
    const start = timeToMinutes(task.startTime);
    if (Number.isFinite(start)) getOccupiedStarts(task.date).add(start);
  }

  for (const draft of drafts) {
    if (draft.startTime) {
      const start = timeToMinutes(draft.startTime);
      if (Number.isFinite(start)) {
        getOccupiedStarts(draft.date || targetDate).add(start);
      }
    }
  }

  const withTime = drafts.filter((draft) => Boolean(draft.startTime));
  const unscheduled = drafts
    .filter((draft) => !draft.startTime)
    .sort((first, second) => PRIORITY_RANK[second.priority] - PRIORITY_RANK[first.priority]);
  const result: AiDraftTask[] = [...withTime];

  for (const draft of unscheduled) {
    const occupiedStarts = getOccupiedStarts(draft.date || targetDate);
    const slot = findBestStart(
      occupiedStarts,
      draft.priority,
      draft.title,
      DAY_START,
      DAY_END,
    );

    if (slot === null) {
      result.push({ ...draft, startTime: '', slottingStatus: 'unscheduled' });
      continue;
    }

    occupiedStarts.add(slot);
    result.push({
      ...draft,
      startTime: minutesToTime(slot),
      source: 'auto_slotted',
      slottingStatus: 'scheduled',
    });
  }

  return result;
}

function findBestStart(
  occupied: ReadonlySet<number>,
  priority: TaskPriority,
  titleHint: string,
  dayStart: number,
  dayEnd: number,
): number | null {
  const title = titleHint.toLowerCase();
  let preferredStart = dayStart;

  if (/chiều|buổi chiều/i.test(title)) {
    preferredStart = 14 * 60 + 30;
  } else if (/tối|buổi tối/i.test(title)) {
    preferredStart = 19 * 60 + 30;
  } else if (/trưa|buổi trưa/i.test(title)) {
    preferredStart = 12 * 60;
  } else if (/sáng|buổi sáng/i.test(title)) {
    preferredStart = dayStart;
  } else if (priority === 'medium') {
    preferredStart = 13 * 60 + 30;
  } else if (priority === 'low' || priority === 'none') {
    preferredStart = 17 * 60;
  }

  for (let start = preferredStart; start <= dayEnd; start += SLOT_INCREMENT) {
    if (!occupied.has(start)) return start;
  }

  for (let start = dayStart; start < preferredStart; start += SLOT_INCREMENT) {
    if (!occupied.has(start)) return start;
  }

  return null;
}
