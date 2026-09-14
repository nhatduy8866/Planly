import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { Language } from '../i18n/translations';
import { cancelTaskReminder } from '../services/notifications';
import { usePlannerDispatch } from '../store/PlannerContext';
import type { ThemeMode } from '../theme/colors';
import type { Task } from '../types';
import { consumeTodayWidgetCompletions } from '../widgets/todayWidgetActions';
import {
  applyTodayWidgetCompletions,
  type TodayWidgetCompletionState,
} from '../widgets/todayWidgetData';
import { syncTodayWidget } from '../widgets/todayWidgetSync';

export function useTodayWidgetSync(
  tasks: Task[],
  language: Language,
  theme: ThemeMode,
  enabled: boolean,
): void {
  const dispatch = usePlannerDispatch();
  const latestStateRef = useRef({ enabled, language, tasks, theme });
  const reconciliationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reconciliationTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const requestReconciliationRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    latestStateRef.current = { enabled, language, tasks, theme };
  }, [enabled, language, tasks, theme]);

  const reconcileAndSync = useCallback(async () => {
    const current = latestStateRef.current;
    if (!current.enabled) return;

    let completionState: TodayWidgetCompletionState = {
      active: [],
      ready: [],
    };
    try {
      completionState = await consumeTodayWidgetCompletions();
    } catch {
      // Widget interaction storage can be unavailable in Expo Go.
    }

    const nextTasks = applyTodayWidgetCompletions(
      current.tasks,
      completionState.ready,
    );
    if (nextTasks !== current.tasks) {
      const completedTaskIds = new Set(
        completionState.ready.map((completion) => completion.taskId),
      );
      await Promise.all(
        current.tasks
          .filter((task) => completedTaskIds.has(task.id) && !task.completed)
          .map((task) => cancelTaskReminder(task.notificationId)),
      );
      dispatch({
        type: 'upsert_tasks',
        payload: nextTasks.filter((task, index) => task !== current.tasks[index]),
      });
    }

    await syncTodayWidget(
      nextTasks,
      current.language,
      current.theme,
      completionState.active,
    );

    const nextExpiry = completionState.active.reduce(
      (earliest, completion) => Math.min(earliest, completion.undoUntil),
      Number.POSITIVE_INFINITY,
    );
    if (Number.isFinite(nextExpiry)) {
      reconciliationTimerRef.current = setTimeout(
        () => requestReconciliationRef.current(),
        Math.max(0, nextExpiry - Date.now()) + 25,
      );
    }
  }, [dispatch]);

  const requestReconciliation = useCallback(() => {
    if (reconciliationTimerRef.current !== undefined) {
      clearTimeout(reconciliationTimerRef.current);
      reconciliationTimerRef.current = undefined;
    }
    reconciliationQueueRef.current = reconciliationQueueRef.current
      .catch(() => undefined)
      .then(reconcileAndSync)
      .catch(() => undefined);
  }, [reconcileAndSync]);

  useEffect(() => {
    requestReconciliationRef.current = requestReconciliation;
  }, [requestReconciliation]);

  useEffect(() => {
    requestReconciliation();
  }, [enabled, language, requestReconciliation, tasks, theme]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') requestReconciliation();
    });
    return () => subscription.remove();
  }, [requestReconciliation]);

  useEffect(
    () => () => {
      if (reconciliationTimerRef.current !== undefined) {
        clearTimeout(reconciliationTimerRef.current);
      }
    },
    [],
  );
}
