import type { Language } from '../i18n/translations';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import type { TodayWidgetCompletion } from './todayWidgetData';

export async function syncTodayWidget(
  _tasks: Task[],
  _language: Language,
  _theme: ThemeMode,
  _pendingCompletions: TodayWidgetCompletion[] = [],
): Promise<void> {}
