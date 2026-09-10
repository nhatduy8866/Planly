import { useCallback } from 'react';

import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '../services/notifications';
import { replaceTaskReminders } from '../services/reminderTransaction';
import { usePreferences } from '../preferences/PreferencesContext';
import {
  usePlannerDispatch,
  usePlannerTasks,
} from '../store/PlannerContext';
import type { Task } from '../types';
import { createId } from '../utils/id';
import { assertNoTaskTimeConflicts } from '../utils/taskConflicts';
import { buildTaskEdits } from '../utils/taskEdits';
import type { TaskFormValues } from '../components/TaskFormModal';

export function useTaskActions() {
  const plannerTasks = usePlannerTasks();
  const dispatch = usePlannerDispatch();
  const { language, t } = usePreferences();

  const saveTask = useCallback(
    async (values: TaskFormValues, existing?: Task) => {
      const now = new Date().toISOString();
      const { applyToBatch = false, batchDates, ...taskValues } = values;

      if (existing) {
        const editedTasks = buildTaskEdits(plannerTasks, existing, taskValues, {
          applyToBatch,
          updatedAt: now,
        });
        assertNoTaskTimeConflicts(editedTasks, plannerTasks);
        const tasksWithReminders = await replaceTaskReminders(
          editedTasks,
          plannerTasks,
          { language },
        );

        if (tasksWithReminders.length === 1) {
          dispatch({ type: 'upsert_task', payload: tasksWithReminders[0] });
        } else {
          dispatch({ type: 'upsert_tasks', payload: tasksWithReminders });
        }
        return;
      }

      const targetDates = Array.from(
        new Set(batchDates?.length ? batchDates : [values.date]),
      ).sort();
      const batchId = batchDates ? createId('batch') : undefined;
      const nextOrderByDate = new Map<string, number>();

      for (const targetDate of targetDates) {
        nextOrderByDate.set(
          targetDate,
          plannerTasks
            .filter((task) => task.date === targetDate)
            .reduce(
              (max, task) => Math.max(max, task.order ?? -1),
              -1,
            ) + 1,
        );
      }

      const tasks: Task[] = targetDates.map((targetDate) => ({
        ...taskValues,
        date: targetDate,
        batchId,
        id: createId('task'),
        completed: false,
        order: nextOrderByDate.get(targetDate) ?? 0,
        createdAt: now,
        updatedAt: now,
      }));

      assertNoTaskTimeConflicts(tasks, plannerTasks);

      for (const task of tasks) {
        try {
          task.notificationId = await scheduleTaskReminder(task, language);
        } catch {
          task.notificationId = undefined;
        }
      }

      if (tasks.length === 1) {
        dispatch({ type: 'upsert_task', payload: tasks[0] });
      } else {
        dispatch({ type: 'create_batch_tasks', payload: tasks });
      }
    },
    [dispatch, language, plannerTasks],
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
          plannerTasks
            .filter((item) => item.date === source.date)
            .reduce((max, item) => Math.max(max, item.order ?? -1), -1) + 1,
        createdAt: now,
        updatedAt: now,
      };
      assertNoTaskTimeConflicts([task], plannerTasks);
      try {
        task.notificationId = await scheduleTaskReminder(task, language);
      } catch {
        task.notificationId = undefined;
      }
      dispatch({ type: 'upsert_task', payload: task });
    },
    [dispatch, language, plannerTasks, t],
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
