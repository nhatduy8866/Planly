import { Platform } from 'react-native';
import {
  registerWidgetTaskHandler,
  type WidgetTaskHandlerProps,
} from 'react-native-android-widget';

import { renderAndroidTodayWidget } from './AndroidTodayWidget';
import { cancelTaskReminder } from '../services/notifications';
import {
  applyTodayWidgetCompletions,
  createTodayWidgetSnapshot,
  TODAY_WIDGET_COMPLETE_ACTION,
  TODAY_WIDGET_UNDO_ACTION,
  TODAY_WIDGET_UNDO_WINDOW_MS,
  splitTodayWidgetCompletions,
  type TodayWidgetCompletion,
} from './todayWidgetData';
import {
  loadTodayWidgetState,
  queueTodayWidgetCompletion,
  removeTodayWidgetCompletion,
} from './todayWidgetStorage';

interface WidgetTaskClick {
  action: typeof TODAY_WIDGET_COMPLETE_ACTION | typeof TODAY_WIDGET_UNDO_ACTION;
  taskId: string;
}

function clickedTask(props: WidgetTaskHandlerProps): WidgetTaskClick | undefined {
  if (
    props.widgetAction !== 'WIDGET_CLICK' ||
    (props.clickAction !== TODAY_WIDGET_COMPLETE_ACTION &&
      props.clickAction !== TODAY_WIDGET_UNDO_ACTION)
  ) {
    return undefined;
  }

  const taskId = props.clickActionData?.taskId;
  if (typeof taskId !== 'string' || taskId.length === 0) return undefined;
  return { action: props.clickAction, taskId };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function renderCurrentWidgetState(
  props: WidgetTaskHandlerProps,
): Promise<TodayWidgetCompletion[]> {
  const state = await loadTodayWidgetState();
  const completionState = splitTodayWidgetCompletions(
    state.pendingCompletions,
  );
  const readyTaskIds = new Set(
    completionState.ready.map((completion) => completion.taskId),
  );
  await Promise.all(
    state.tasks
      .filter((task) => readyTaskIds.has(task.id) && !task.completed)
      .map((task) => cancelTaskReminder(task.notificationId)),
  );
  const effectiveTasks = applyTodayWidgetCompletions(
    state.tasks,
    completionState.ready,
  );
  const snapshot = createTodayWidgetSnapshot(
    effectiveTasks,
    state.language,
    new Date(),
    state.theme,
    completionState.active,
  );
  props.renderWidget(renderAndroidTodayWidget(snapshot, props.widgetInfo));
  return completionState.active;
}

async function todayWidgetTaskHandler(
  props: WidgetTaskHandlerProps,
): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED') return;

  const state = await loadTodayWidgetState();
  const click = clickedTask(props);
  const task = click
    ? state.tasks.find((candidate) => candidate.id === click.taskId)
    : undefined;
  const completionState = splitTodayWidgetCompletions(
    state.pendingCompletions,
  );

  if (
    click?.action === TODAY_WIDGET_COMPLETE_ACTION &&
    task &&
    !task.completed &&
    !state.pendingCompletions.some(
      (completion) => completion.taskId === task.id,
    )
  ) {
    const now = Date.now();
    const completion: TodayWidgetCompletion = {
      completedAt: new Date(now).toISOString(),
      taskId: task.id,
      undoUntil: now + TODAY_WIDGET_UNDO_WINDOW_MS,
    };
    await queueTodayWidgetCompletion(completion);
  } else if (
    click?.action === TODAY_WIDGET_UNDO_ACTION &&
    completionState.active.some(
      (completion) => completion.taskId === click.taskId,
    )
  ) {
    await removeTodayWidgetCompletion(click.taskId);
  }

  const activeCompletions = await renderCurrentWidgetState(props);
  const nextExpiry = activeCompletions.reduce(
    (earliest, completion) => Math.min(earliest, completion.undoUntil),
    Number.POSITIVE_INFINITY,
  );
  if (Number.isFinite(nextExpiry)) {
    await wait(Math.max(0, nextExpiry - Date.now()) + 25);
    await renderCurrentWidgetState(props);
  }
}

export function registerTodayWidgetTaskHandler(): void {
  if (Platform.OS !== 'android') return;
  registerWidgetTaskHandler(todayWidgetTaskHandler);
}
