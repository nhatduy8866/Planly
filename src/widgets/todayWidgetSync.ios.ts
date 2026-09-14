import type { Language } from '../i18n/translations';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import { planlyTodayWidget } from './PlanlyTodayWidget';
import {
  createTodayWidgetSnapshot,
  type TodayWidgetCompletion,
} from './todayWidgetData';

const TIMELINE_DAYS = 7;

export async function syncTodayWidget(
  tasks: Task[],
  language: Language,
  theme: ThemeMode,
  pendingCompletions: TodayWidgetCompletion[] = [],
): Promise<void> {
  const now = new Date();
  const entries = Array.from({ length: TIMELINE_DAYS }, (_, index) => {
    const date =
      index === 0
        ? now
        : new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + index,
            0,
            0,
            1,
          );
    return {
      date,
      props: createTodayWidgetSnapshot(
        tasks,
        language,
        date,
        theme,
        index === 0 ? pendingCompletions : [],
      ),
    };
  });

  planlyTodayWidget.updateTimeline(entries);
}
