import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Language } from '../i18n/translations';
import {
  LEGACY_PLANNER_STORAGE_KEY,
  SYNC_CACHE_OWNER_STORAGE_KEY,
  TODAY_WIDGET_COMPLETIONS_STORAGE_KEY,
} from '../storage/keys';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import { syncTodayWidget } from '../widgets/todayWidgetSync';
import { clearStoredAlarmMedia } from './alarmMedia';
import { cancelTaskReminder } from './notifications';
import { clearSyncOutbox } from './sync/outbox';

export type LocalDataCleanupMode = 'signOut' | 'deleteAccount';

interface ClearLocalPlanlyDataOptions {
  language: Language;
  mode: LocalDataCleanupMode;
  persistTasks: (tasks: Task[]) => Promise<void>;
  resetPreferences: () => Promise<void>;
  tasks: Task[];
  theme: ThemeMode;
}

export async function clearLocalPlanlyData({
  language,
  mode,
  persistTasks,
  resetPreferences,
  tasks,
  theme,
}: ClearLocalPlanlyDataOptions): Promise<void> {
  await Promise.all(
    tasks.map(async (task) => {
      try {
        await cancelTaskReminder(task.notificationId);
      } catch {
        // A reminder may already have fired or been removed. Stale native
        // scheduler state must not prevent the account cache from being erased.
      }
    }),
  );

  const failures: unknown[] = [];
  const attempt = async (work: () => Promise<void>): Promise<boolean> => {
    try {
      await work();
      return true;
    } catch (error) {
      failures.push(error);
      return false;
    }
  };

  // This write is ordered behind any pending planner write, preventing an old
  // debounced task snapshot from reappearing after the owner marker is removed.
  await Promise.all([
    attempt(() => persistTasks([])),
    attempt(() => clearSyncOutbox()),
    attempt(() => syncTodayWidget([], language, theme, [])),
    ...(mode === 'deleteAccount'
      ? [
          attempt(() => clearStoredAlarmMedia()),
          attempt(() => resetPreferences()),
        ]
      : []),
  ]);

  // Keep the owner marker as a retry signal unless every data surface above
  // was cleared. A failed task write must not become ownerless visible data.
  if (failures.length === 0) {
    await attempt(() => AsyncStorage.multiRemove([
      LEGACY_PLANNER_STORAGE_KEY,
      SYNC_CACHE_OWNER_STORAGE_KEY,
      TODAY_WIDGET_COMPLETIONS_STORAGE_KEY,
    ]));
  }

  if (failures.length > 0) throw failures[0];
}
