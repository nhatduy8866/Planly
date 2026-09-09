import type { Task } from '../../types';
import type { AiDraftTask, AiSchedulingContext } from '../../types/ai';
import { resolveScheduleDate } from './dateIntent';
import { parseVietnameseTime } from './timeIntent';

const TOKEN_NOISE = new Set([
  'cap',
  'chinh',
  'chuyen',
  'cho',
  'cong',
  'doi',
  'den',
  'gio',
  'giup',
  'hay',
  'hom',
  'lai',
  'luc',
  'mai',
  'minh',
  'muon',
  'ngay',
  'nha',
  'nhat',
  'nhe',
  'nua',
  'sang',
  'sua',
  'task',
  'thanh',
  'thu',
  'toi',
  'tuan',
  'tu',
  'vao',
  'viec',
]);
const GENERIC_MATCH_TOKENS = new Set(['cong', 'lich', 'task', 'viec']);

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function meaningfulTokens(value: string): string[] {
  return normalizeVietnamese(value)
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token &&
        !TOKEN_NOISE.has(token) &&
        !/^\d+(?:h\d*)?$/.test(token),
    );
}

export function isTaskUpdateIntent(text: string): boolean {
  const normalized = normalizeVietnamese(text).trim();
  if (!normalized) return false;

  return (
    /(?:^|\s)(?:chinh|cap\s+nhat)(?=$|\s).*?(?:lich|gio|task|cong\s+viec|lai|thanh|sang)/.test(
      normalized,
    ) ||
    /(?:^|\s)sua(?=$|\s).*?(?:lich|gio|task|cong\s+viec|lai|thanh|sang)/.test(
      normalized,
    ) ||
    /(?:^|\s)(?:doi|chuyen)(?=$|\s).*?(?:sang|toi|den|luc|ngay|gio|lich|thanh)/.test(
      normalized,
    )
  );
}

function taskMatchScore(queryTokens: string[], task: Task): number {
  const titleTokens = meaningfulTokens(task.title);
  if (!titleTokens.length || !queryTokens.length) return 0;

  const querySet = new Set(queryTokens);
  const matchedTokens = titleTokens.filter((token) => querySet.has(token));
  const hasDistinctiveMatch = matchedTokens.some(
    (token) => !GENERIC_MATCH_TOKENS.has(token),
  );
  if (!hasDistinctiveMatch) return 0;

  const titleCoverage = matchedTokens.length / titleTokens.length;
  const queryCoverage = matchedTokens.length / new Set(queryTokens).size;
  if (titleCoverage < 0.5) return 0;

  return titleCoverage * 0.7 + queryCoverage * 0.3;
}

function findReferencedTask(
  text: string,
  tasks: Task[],
): Task | undefined {
  const queryTokens = meaningfulTokens(text);
  return tasks
    .map((task) => ({ task, score: taskMatchScore(queryTokens, task) }))
    .filter(({ score }) => score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.task.createdAt.localeCompare(second.task.createdAt) ||
        first.task.order - second.task.order,
    )[0]?.task;
}

/**
 * Returns null when the text is not an update command, [] when it is an
 * update but no task can be resolved, or one draft retaining the matched ID.
 */
export function resolveExistingTaskUpdate(
  text: string,
  context: AiSchedulingContext,
): AiDraftTask[] | null {
  if (!isTaskUpdateIntent(text)) return null;

  const dateResolution = resolveScheduleDate(text, context);
  const allTasks = context.allTasks || context.existingTasks;
  const activeTasks = allTasks.filter((task) => !task.completed);
  const tasksOnViewedDate = activeTasks.filter(
    (task) => task.date === context.targetDate,
  );
  const matchedTask =
    findReferencedTask(text, tasksOnViewedDate) ||
    findReferencedTask(text, activeTasks);
  if (!matchedTask) return [];

  const parsedTime = parseVietnameseTime(text, true);
  return [
    {
      id: matchedTask.id,
      title: matchedTask.title,
      date: dateResolution.hasExplicitDate
        ? dateResolution.date
        : matchedTask.date,
      startTime: parsedTime?.startTime || matchedTask.startTime,
      reminderMinutes: matchedTask.reminderMinutes,
      priority: matchedTask.priority || 'none',
      source: 'direct_request',
      changeStatus: 'updated',
    },
  ];
}
