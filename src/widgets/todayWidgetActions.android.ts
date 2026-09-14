import type { TodayWidgetCompletionState } from './todayWidgetData';
import { consumeTodayWidgetCompletionQueue } from './todayWidgetStorage';

export function consumeTodayWidgetCompletions(): Promise<
  TodayWidgetCompletionState
> {
  return consumeTodayWidgetCompletionQueue();
}
