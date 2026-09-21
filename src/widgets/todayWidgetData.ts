import type { Language } from '../i18n/translations';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import { formatCompactDate, timeToMinutes, toDateKey } from '../utils/date';

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

const MAX_SNAPSHOT_TASKS = 1;
const DEFAULT_TASK_COLOR = '#4F46E5';

export const TODAY_WIDGET_COMPLETE_ACTION = 'COMPLETE_TASK';
export const TODAY_WIDGET_UNDO_ACTION = 'UNDO_COMPLETE_TASK';
export const TODAY_WIDGET_UNDO_WINDOW_MS = 5_000;

function safeTaskColor(color: string | undefined): `#${string}` {
  return color && /^#[0-9a-f]{6}$/i.test(color)
    ? (color as `#${string}`)
    : DEFAULT_TASK_COLOR;
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
  const referenceTime = date.getHours() * 60 + date.getMinutes();
  const dayTasks = tasks
    .filter((task) => task.date === dateKey)
    .sort(
      (first, second) =>
        timeToMinutes(first.startTime) - timeToMinutes(second.startTime) ||
        (first.order ?? 0) - (second.order ?? 0) ||
        first.createdAt.localeCompare(second.createdAt) ||
        first.id.localeCompare(second.id),
    );
  const upcomingTasks = dayTasks.filter(
    (task) => !task.completed && timeToMinutes(task.startTime) >= referenceTime,
  );

  return {
    completedCount: dayTasks.filter((task) => task.completed).length,
    dateLabel: formatCompactDate(dateKey, locale),
    emptyLabel:
      language === 'vi'
        ? 'Không còn công việc sắp tới'
        : 'No upcoming tasks',
    language,
    pendingCompletions,
    tasks: upcomingTasks.slice(0, MAX_SNAPSHOT_TASKS).map((task) => ({
      color: safeTaskColor(task.color),
      completed: task.completed,
      id: task.id,
      startTime: task.startTime,
      title:
        task.title.trim() ||
        (language === 'vi' ? 'Công việc chưa đặt tên' : 'Untitled task'),
    })),
    theme,
    todayLabel: language === 'vi' ? 'Hôm nay' : 'Today',
    totalCount: dayTasks.length,
    undoLabel: language === 'vi' ? 'Chạm để hoàn tác' : 'Tap to undo',
    upcomingCount: upcomingTasks.length,
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
