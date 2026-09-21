import {
  splitTodayWidgetCompletions,
  type TodayWidgetCompletion,
  type TodayWidgetCompletionState,
} from './todayWidgetData';
import { planlyTodayWidget } from './PlanlyTodayWidget';

function isTodayWidgetCompletion(
  value: unknown,
): value is TodayWidgetCompletion {
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
}

export async function consumeTodayWidgetCompletions(): Promise<
  TodayWidgetCompletionState
> {
  const timeline = await planlyTodayWidget.getTimeline();
  const byTaskId = new Map<string, TodayWidgetCompletion>();

  for (const entry of timeline) {
    for (const completion of entry.props.pendingCompletions ?? []) {
      if (isTodayWidgetCompletion(completion)) {
        byTaskId.set(completion.taskId, completion);
      }
    }
  }

  return splitTodayWidgetCompletions(Array.from(byTaskId.values()));
}
