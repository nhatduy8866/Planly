import { useCallback } from 'react';

import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '../services/notifications';
import { usePlanner } from '../store/PlannerContext';
import type { Task } from '../types';
import { createId } from '../utils/id';
import type { TaskFormValues } from '../components/TaskFormModal';

export function useTaskActions() {
  const { state, dispatch } = usePlanner();

  const saveTask = useCallback(
    async (values: TaskFormValues, existing?: Task) => {
      const now = new Date().toISOString();
      const nextOrder =
        existing?.date === values.date
          ? (existing.order ?? 0)
          : state.tasks
              .filter((task) => task.date === values.date)
              .reduce((max, task) => Math.max(max, task.order ?? -1), -1) + 1;

      const task: Task = {
        ...values,
        id: existing?.id ?? createId('task'),
        completed: existing?.completed ?? false,
        order: nextOrder,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      await cancelTaskReminder(existing?.notificationId);
      try {
        task.notificationId = await scheduleTaskReminder(task);
      } catch {
        task.notificationId = undefined;
      }
      dispatch({ type: 'upsert_task', payload: task });
    },
    [dispatch, state.tasks],
  );

  const duplicateTask = useCallback(
    async (source: Task) => {
      const now = new Date().toISOString();
      const task: Task = {
        ...source,
        id: createId('task'),
        title: `${source.title} (bản sao)`,
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
        task.notificationId = await scheduleTaskReminder(task);
      } catch {
        task.notificationId = undefined;
      }
      dispatch({ type: 'upsert_task', payload: task });
    },
    [dispatch, state.tasks],
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
          task.notificationId = await scheduleTaskReminder(task);
        } catch {
          task.notificationId = undefined;
        }
      }
      dispatch({ type: 'upsert_task', payload: task });
    },
    [dispatch],
  );

  return { deleteTask, duplicateTask, saveTask, toggleTask };
}
