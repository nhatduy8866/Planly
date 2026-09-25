import type { Language } from '../i18n/translations';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import {
  formatCompactDate,
  taskDateTime,
  timeToMinutes,
  toDateKey,
} from '../utils/date';

export const TODAY_WIDGET_NAME = 'PlanlyToday';
export const TODAY_WIDGET_URI = 'planly:///';

export interface TodayWidgetTask {
  color: `#${string}`;
  completed: boolean;
  id: string;
  startTime: string;
  title: string;
}

export interface TodayWidgetCompletion {
  completedAt: string;
  taskId: string;
  undoUntil: number;
}

export interface TodayWidgetCompletionState {
  active: TodayWidgetCompletion[];
  ready: TodayWidgetCompletion[];
}

export interface TodayWidgetSnapshot {
  completedCount: number;
  dateLabel: string;
  emptyLabel: string;
  language: Language;
  pendingCompletions: TodayWidgetCompletion[];
  tasks: TodayWidgetTask[];
  theme: ThemeMode;
  todayLabel: string;
  totalCount: number;
  undoLabel: string;
  upcomingCount: number;
}

const DEFAULT_TASK_COLOR = '#4F46E5';

export const TODAY_WIDGET_COMPLETE_ACTION = 'COMPLETE_TASK';
export const TODAY_WIDGET_UNDO_ACTION = 'UNDO_COMPLETE_TASK';
export const TODAY_WIDGET_UNDO_WINDOW_MS = 5_000;

function safeTaskColor(color: string | undefined): `#${string}` {
  return color && /^#[0-9a-f]{6}$/i.test(color)
    ? (color as `#${string}`)
    : DEFAULT_TASK_COLOR;
}

function compareWidgetTasks(first: Task, second: Task): number {
  return (
    timeToMinutes(first.startTime) - timeToMinutes(second.startTime) ||
    first.order - second.order ||
    first.createdAt.localeCompare(second.createdAt) ||
    first.id.localeCompare(second.id)
  );
}

export function getNextTodayWidgetRefreshTime(
  tasks: Task[],
  date = new Date(),
): number {
  const dateKey = toDateKey(date);
  let nextRefresh = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();

  for (const task of tasks) {
    if (task.completed || task.date !== dateKey) continue;
    const startTime = taskDateTime(task.date, task.startTime).getTime();
    if (
      Number.isFinite(startTime) &&
      startTime > date.getTime() &&
      startTime < nextRefresh
    ) {
      nextRefresh = startTime;
    }
  }

  return nextRefresh;
}

export function createTodayWidgetSnapshot(
  tasks: Task[],
  language: Language,
  date = new Date(),
  theme: ThemeMode = 'light',
  pendingCompletions: TodayWidgetCompletion[] = [],
): TodayWidgetSnapshot {
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const dateKey = toDateKey(date);
  const referenceTime = date.getTime();
  let completedCount = 0;
  let nextUpcomingTask: Task | undefined;
  let totalCount = 0;
  let upcomingCount = 0;

  for (const task of tasks) {
    if (task.date !== dateKey) continue;
    totalCount += 1;
    if (task.completed) {
      completedCount += 1;
      continue;
    }

    const taskStart = taskDateTime(task.date, task.startTime).getTime();
    if (!Number.isFinite(taskStart) || taskStart <= referenceTime) continue;
    upcomingCount += 1;
    if (!nextUpcomingTask || compareWidgetTasks(task, nextUpcomingTask) < 0) {
      nextUpcomingTask = task;
    }
  }

  return {
    completedCount,
    dateLabel: formatCompactDate(dateKey, locale),
    emptyLabel:
      language === 'vi'
        ? 'Không còn công việc sắp tới'
        : 'No upcoming tasks',
    language,
    pendingCompletions,
    tasks: nextUpcomingTask
      ? [{
          color: safeTaskColor(nextUpcomingTask.color),
          completed: nextUpcomingTask.completed,
          id: nextUpcomingTask.id,
          startTime: nextUpcomingTask.startTime,
          title:
            nextUpcomingTask.title.trim() ||
            (language === 'vi' ? 'Công việc chưa đặt tên' : 'Untitled task'),
        }]
      : [],
    theme,
    todayLabel: language === 'vi' ? 'Hôm nay' : 'Today',
    totalCount,
    undoLabel: language === 'vi' ? 'Chạm để hoàn tác' : 'Tap to undo',
    upcomingCount,
  };
}

export function applyTodayWidgetCompletions(
  tasks: Task[],
  completions: TodayWidgetCompletion[],
): Task[] {
  if (completions.length === 0) return tasks;

  const completionByTaskId = new Map(
    completions.map((completion) => [completion.taskId, completion]),
  );
  let changed = false;
  const nextTasks = tasks.map((task) => {
    const completion = completionByTaskId.get(task.id);
    if (!completion || task.completed) return task;
    changed = true;
    return {
      ...task,
      completed: true,
      notificationId: undefined,
      updatedAt: completion.completedAt,
    };
  });

  return changed ? nextTasks : tasks;
}

export function completeTodayWidgetSnapshot(
  snapshot: TodayWidgetSnapshot,
  taskId: string,
  completedAt: string,
): TodayWidgetSnapshot {
  const target = snapshot.tasks.find(
    (task) => task.id === taskId && !task.completed,
  );
  if (!target) return snapshot;

  return {
    ...snapshot,
    completedCount: snapshot.completedCount + 1,
    pendingCompletions: [
      ...(snapshot.pendingCompletions ?? []),
      {
        completedAt,
        taskId,
        undoUntil: Date.parse(completedAt) + TODAY_WIDGET_UNDO_WINDOW_MS,
      },
    ],
    tasks: snapshot.tasks.map((task) =>
      task.id === taskId ? { ...task, completed: true } : task,
    ),
    upcomingCount: Math.max(0, snapshot.upcomingCount - 1),
  };
}

export function undoTodayWidgetSnapshotCompletion(
  snapshot: TodayWidgetSnapshot,
  taskId: string,
  now = Date.now(),
): TodayWidgetSnapshot {
  const pendingCompletion = (snapshot.pendingCompletions ?? []).find(
    (completion) => completion.taskId === taskId,
  );
  if (!pendingCompletion || pendingCompletion.undoUntil <= now) {
    return snapshot;
  }
  const pendingCompletions = (snapshot.pendingCompletions ?? []).filter(
    (completion) => completion.taskId !== taskId,
  );

  return {
    ...snapshot,
    completedCount: Math.max(0, snapshot.completedCount - 1),
    pendingCompletions,
    tasks: snapshot.tasks.map((task) =>
      task.id === taskId ? { ...task, completed: false } : task,
    ),
    upcomingCount: snapshot.upcomingCount + 1,
  };
}

export function splitTodayWidgetCompletions(
  completions: TodayWidgetCompletion[],
  now = Date.now(),
): TodayWidgetCompletionState {
  return completions.reduce<TodayWidgetCompletionState>(
    (state, completion) => {
      state[completion.undoUntil > now ? 'active' : 'ready'].push(completion);
      return state;
    },
    { active: [], ready: [] },
  );
}
