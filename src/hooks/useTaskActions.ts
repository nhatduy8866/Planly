import { useCallback } from 'react';

import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '../services/notifications';
import { usePreferences } from '../preferences/PreferencesContext';
import { usePlanner } from '../store/PlannerContext';
import type { Task } from '../types';
import { createId } from '../utils/id';
import type { TaskFormValues } from '../components/TaskFormModal';

export function useTaskActions() {
  const { state, dispatch } = usePlanner();
  const { language, t } = usePreferences();

  const saveTask = useCallback(
    async (values: TaskFormValues, existing?: Task) => {
      const now = new Date().toISOString();
      const { batchDates, ...taskValues } = values;
      const targetDates = existing
        ? [values.date]
        : Array.from(
            new Set(batchDates?.length ? batchDates : [values.date]),
          ).sort();
      const batchId =
        existing?.batchId ?? (!existing && batchDates ? createId('batch') : undefined);
      const nextOrderByDate = new Map<string, number>();

      for (const targetDate of targetDates) {
        nextOrderByDate.set(
          targetDate,
          existing?.date === targetDate
            ? (existing.order ?? 0)
            : state.tasks
                .filter((task) => task.date === targetDate)
                .reduce(
                  (max, task) => Math.max(max, task.order ?? -1),
                  -1,
                ) + 1,
        );
      }

      if (existing) await cancelTaskReminder(existing.notificationId);

      const tasks: Task[] = [];
      for (const targetDate of targetDates) {
        const task: Task = {
          ...taskValues,
          date: targetDate,
          durationMinutes: existing?.durationMinutes ?? 0,
          batchId,
          id: existing?.id ?? createId('task'),
          completed: existing?.completed ?? false,
          order: nextOrderByDate.get(targetDate) ?? 0,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        try {
          task.notificationId = await scheduleTaskReminder(task, language);
        } catch {
          task.notificationId = undefined;
        }
        tasks.push(task);
      }

      if (existing || tasks.length === 1) {
        dispatch({ type: 'upsert_task', payload: tasks[0] });
      } else {
        dispatch({ type: 'create_batch_tasks', payload: tasks });
      }
    },
    [dispatch, language, state.tasks],
  );

  const duplicateTask = useCallback(
    async (source: Task) => {
      const now = new Date().toISOString();
      const task: Task = {
        ...source,
        batchId: undefined,
        id: createId('task'),
        title: `${source.title} (${t('task.copySuffix')})`,
        notificationId: undefined,
        completed: false,
        order:
          state.tasks
            .filter((item) => item.date === source.date)
            .reduce((max, item) => Math.max(max, item.order ?? -1), -1) + 1,
        createdAt: now,
        updatedAt: now,
      };
      try {
        task.notificationId = await scheduleTaskReminder(task, language);
      } catch {
        task.notificationId = undefined;
      }
      dispatch({ type: 'upsert_task', payload: task });
    },
    [dispatch, language, state.tasks, t],
  );

  const deleteTask = useCallback(
    async (task: Task) => {
      dispatch({ type: 'delete_task', payload: { id: task.id } });
      try {
        await cancelTaskReminder(task.notificationId);
      } catch {
        // Notification might already have fired or failed
      }
    },
    [dispatch],
  );

  const toggleTask = useCallback(
    async (source: Task) => {
      const task: Task = {
        ...source,
        completed: !source.completed,
        notificationId: undefined,
        updatedAt: new Date().toISOString(),
      };

      await cancelTaskReminder(source.notificationId);
      if (!task.completed) {
        try {
          task.notificationId = await scheduleTaskReminder(task, language);
        } catch {
          task.notificationId = undefined;
        }
      }
      dispatch({ type: 'upsert_task', payload: task });
    },
    [dispatch, language],
  );

  return { deleteTask, duplicateTask, saveTask, toggleTask };
}
