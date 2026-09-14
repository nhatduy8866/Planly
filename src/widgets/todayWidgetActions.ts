import type { TodayWidgetCompletionState } from './todayWidgetData';

export async function consumeTodayWidgetCompletions(): Promise<
  TodayWidgetCompletionState
> {
  return { active: [], ready: [] };
}
