import { requestWidgetUpdate } from 'react-native-android-widget';

import type { Language } from '../i18n/translations';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import { renderAndroidTodayWidget } from './AndroidTodayWidget';
import {
  createTodayWidgetSnapshot,
  TODAY_WIDGET_NAME,
  type TodayWidgetCompletion,
} from './todayWidgetData';

export async function syncTodayWidget(
  tasks: Task[],
  language: Language,
  theme: ThemeMode,
  pendingCompletions: TodayWidgetCompletion[] = [],
): Promise<void> {
  const snapshot = createTodayWidgetSnapshot(
    tasks,
    language,
    new Date(),
    theme,
    pendingCompletions,
  );
  await requestWidgetUpdate({
    widgetName: TODAY_WIDGET_NAME,
    renderWidget: (widgetInfo) =>
      renderAndroidTodayWidget(snapshot, widgetInfo),
  });
}
