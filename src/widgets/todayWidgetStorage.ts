import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Language } from '../i18n/translations';
import {
  PREFERENCES_STORAGE_KEY,
  TASKS_STORAGE_KEY,
  TODAY_WIDGET_COMPLETIONS_STORAGE_KEY,
} from '../storage/keys';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import {
  splitTodayWidgetCompletions,
  type TodayWidgetCompletion,
  type TodayWidgetCompletionState,
} from './todayWidgetData';

let completionStorageQueue: Promise<void> = Promise.resolve();

function isStoredTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.date === 'string' &&
    typeof task.startTime === 'string' &&
    typeof task.completed === 'boolean' &&
    typeof task.createdAt === 'string'
  );
}

export function parseWidgetTasks(raw: string | null): Task[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isStoredTask) : [];
  } catch {
    return [];
  }
}

export function parseWidgetCompletions(
  raw: string | null,
): TodayWidgetCompletion[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is TodayWidgetCompletion => {
      if (!value || typeof value !== 'object') return false;
      const completion = value as Partial<TodayWidgetCompletion>;
      return (
        typeof completion.taskId === 'string' &&
        completion.taskId.length > 0 &&
        typeof completion.completedAt === 'string' &&
        Number.isFinite(Date.parse(completion.completedAt)) &&
        typeof completion.undoUntil === 'number' &&
        Number.isFinite(completion.undoUntil)
      );
    });
  } catch {
    return [];
  }
}

async function readTodayWidgetCompletionsDirect(): Promise<
  TodayWidgetCompletion[]
> {
  return parseWidgetCompletions(
    await AsyncStorage.getItem(TODAY_WIDGET_COMPLETIONS_STORAGE_KEY),
  );
}

export async function readTodayWidgetCompletions(): Promise<
  TodayWidgetCompletion[]
> {
  await completionStorageQueue;
  return readTodayWidgetCompletionsDirect();
}

export function queueTodayWidgetCompletion(
  completion: TodayWidgetCompletion,
): Promise<TodayWidgetCompletion[]> {
  let nextCompletions: TodayWidgetCompletion[] = [];
  completionStorageQueue = completionStorageQueue
    .catch(() => undefined)
    .then(async () => {
      const current = await readTodayWidgetCompletionsDirect();
      const byTaskId = new Map(
        current.map((item) => [item.taskId, item]),
      );
      byTaskId.set(completion.taskId, completion);
      nextCompletions = Array.from(byTaskId.values());
      await AsyncStorage.setItem(
        TODAY_WIDGET_COMPLETIONS_STORAGE_KEY,
        JSON.stringify(nextCompletions),
      );
    });

  return completionStorageQueue.then(() => nextCompletions);
}

export function removeTodayWidgetCompletion(
  taskId: string,
): Promise<TodayWidgetCompletion[]> {
  let remainingCompletions: TodayWidgetCompletion[] = [];
  completionStorageQueue = completionStorageQueue
    .catch(() => undefined)
    .then(async () => {
      const current = await readTodayWidgetCompletionsDirect();
      remainingCompletions = current.filter(
        (completion) => completion.taskId !== taskId,
      );
      if (remainingCompletions.length === 0) {
        await AsyncStorage.removeItem(TODAY_WIDGET_COMPLETIONS_STORAGE_KEY);
      } else if (remainingCompletions.length !== current.length) {
        await AsyncStorage.setItem(
          TODAY_WIDGET_COMPLETIONS_STORAGE_KEY,
          JSON.stringify(remainingCompletions),
        );
      }
    });

  return completionStorageQueue.then(() => remainingCompletions);
}

export function consumeTodayWidgetCompletionQueue(
  now = Date.now(),
): Promise<TodayWidgetCompletionState> {
  let completionState: TodayWidgetCompletionState = {
    active: [],
    ready: [],
  };
  completionStorageQueue = completionStorageQueue
    .catch(() => undefined)
    .then(async () => {
      const current = await readTodayWidgetCompletionsDirect();
      completionState = splitTodayWidgetCompletions(current, now);
      if (completionState.active.length > 0) {
        await AsyncStorage.setItem(
          TODAY_WIDGET_COMPLETIONS_STORAGE_KEY,
          JSON.stringify(completionState.active),
        );
      } else if (current.length > 0) {
        await AsyncStorage.removeItem(TODAY_WIDGET_COMPLETIONS_STORAGE_KEY);
      }
    });

  return completionStorageQueue.then(() => completionState);
}

export function parseWidgetLanguage(raw: string | null): Language {
  if (!raw) return 'vi';

  try {
    const parsed = JSON.parse(raw) as { language?: unknown };
    return parsed.language === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function parseWidgetTheme(raw: string | null): ThemeMode {
  if (!raw) return 'light';

  try {
    const parsed = JSON.parse(raw) as { theme?: unknown };
    return parsed.theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export async function loadTodayWidgetState(): Promise<{
  language: Language;
  pendingCompletions: TodayWidgetCompletion[];
  tasks: Task[];
  theme: ThemeMode;
}> {
  const [tasksRaw, preferencesRaw, pendingCompletions] = await Promise.all([
    AsyncStorage.getItem(TASKS_STORAGE_KEY),
    AsyncStorage.getItem(PREFERENCES_STORAGE_KEY),
    readTodayWidgetCompletions(),
  ]);

  return {
    language: parseWidgetLanguage(preferencesRaw),
    pendingCompletions,
    tasks: parseWidgetTasks(tasksRaw),
    theme: parseWidgetTheme(preferencesRaw),
  };
}
