import { useCallback, useMemo } from 'react';

import { useToast } from '../components/AppToast';
import {
  cancelTaskReminder,
  scheduleTaskReminder,
} from '../services/notifications';
import { getAlarmSchedulePreferences } from '../services/alarmPresets';
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

function getNextOrderByDate(
  tasks: Task[],
  targetDates: readonly string[],
): Map<string, number> {
  const nextOrderByDate = new Map(
    targetDates.map((date) => [date, 0]),
  );

  for (const task of tasks) {
    const currentNextOrder = nextOrderByDate.get(task.date);
    if (currentNextOrder === undefined) continue;
    nextOrderByDate.set(
      task.date,
      Math.max(currentNextOrder, task.order + 1),
    );
  }

  return nextOrderByDate;
}

export function useTaskActions() {
  const plannerTasks = usePlannerTasks();
  const dispatch = usePlannerDispatch();
  const { showToast } = useToast();
  const {
    alarmSound,
    alarmSoundPreset,
    alarmVibrationEnabled,
    language,
    reminderDeliveryMode,
    t,
  } = usePreferences();
  const alarmPreferences = useMemo(
    () =>
      getAlarmSchedulePreferences(
        alarmSoundPreset,
        alarmSound,
        alarmVibrationEnabled,
      ),
    [alarmSound, alarmSoundPreset, alarmVibrationEnabled],
  );

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
          { alarmPreferences, language, reminderDeliveryMode },
        );

        if (tasksWithReminders.length === 1) {
          dispatch({ type: 'upsert_task', payload: tasksWithReminders[0] });
        } else {
          dispatch({ type: 'upsert_tasks', payload: tasksWithReminders });
        }
        showToast(
          t(
            tasksWithReminders.length === 1
              ? 'toast.taskUpdated'
              : 'toast.tasksUpdated',
            tasksWithReminders.length === 1
              ? { title: tasksWithReminders[0].title }
              : { count: tasksWithReminders.length },
          ),
        );
        return;
      }

      const targetDates = Array.from(
        new Set(batchDates?.length ? batchDates : [values.date]),
      ).sort();
      const batchId = batchDates ? createId('batch') : undefined;
      const nextOrderByDate = getNextOrderByDate(plannerTasks, targetDates);

      const newTasks: Task[] = targetDates.map((targetDate) => ({
        ...taskValues,
        date: targetDate,
        batchId,
        id: createId('task'),
        completed: false,
        order: nextOrderByDate.get(targetDate) ?? 0,
        createdAt: now,
        updatedAt: now,
      }));

      assertNoTaskTimeConflicts(newTasks, plannerTasks);

      const tasksWithReminders = await Promise.all(
        newTasks.map(async (task) => {
          try {
            const notificationId = await scheduleTaskReminder(
              task,
              language,
              reminderDeliveryMode,
              alarmPreferences,
            );
            return { ...task, notificationId };
          } catch {
            return { ...task, notificationId: undefined };
          }
        }),
      );

      if (tasksWithReminders.length === 1) {
        dispatch({ type: 'upsert_task', payload: tasksWithReminders[0] });
      } else {
        dispatch({ type: 'create_batch_tasks', payload: tasksWithReminders });
      }
      showToast(
        t(
          tasksWithReminders.length === 1
            ? 'toast.taskCreated'
            : 'toast.tasksCreated',
          tasksWithReminders.length === 1
            ? { title: tasksWithReminders[0].title }
            : { count: tasksWithReminders.length },
        ),
      );
    },
    [
      alarmPreferences,
      dispatch,
      language,
      plannerTasks,
      reminderDeliveryMode,
      showToast,
      t,
    ],
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
          getNextOrderByDate(plannerTasks, [source.date]).get(source.date) ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      assertNoTaskTimeConflicts([task], plannerTasks);
      try {
        task.notificationId = await scheduleTaskReminder(
          task,
          language,
          reminderDeliveryMode,
          alarmPreferences,
        );
      } catch {
        task.notificationId = undefined;
      }
      dispatch({ type: 'upsert_task', payload: task });
      showToast(t('toast.taskDuplicated', { title: source.title }));
    },
    [
      alarmPreferences,
      dispatch,
      language,
      plannerTasks,
      reminderDeliveryMode,
      showToast,
      t,
    ],
  );

  const deleteTasks = useCallback(
    async (tasks: Task[]) => {
      if (!tasks.length) return;

      if (tasks.length === 1) {
        dispatch({ type: 'delete_task', payload: { id: tasks[0].id } });
      } else {
        dispatch({
          type: 'delete_tasks',
          payload: { ids: tasks.map((task) => task.id) },
        });
      }

      await Promise.all(
        tasks.map(async (task) => {
          try {
            await cancelTaskReminder(task.notificationId);
          } catch {
            // Notification might already have fired or failed.
          }
        }),
      );
    },
    [dispatch],
  );

  const deleteTask = useCallback(
    async (task: Task, applyToBatch = false) => {
      const tasksToDelete =
        applyToBatch && task.batchId
          ? plannerTasks.filter((item) => item.batchId === task.batchId)
          : [task];
      await deleteTasks(tasksToDelete);
      showToast(
        t(
          tasksToDelete.length === 1
            ? 'toast.taskDeleted'
            : 'toast.tasksDeleted',
          tasksToDelete.length === 1
            ? { title: tasksToDelete[0].title }
            : { count: tasksToDelete.length },
        ),
      );
    },
    [deleteTasks, plannerTasks, showToast, t],
  );

  const deleteAllTasks = useCallback(
    async () => {
      if (!plannerTasks.length) return;
      await deleteTasks(plannerTasks);
      showToast(t('toast.allTasksDeleted'));
    },
    [deleteTasks, plannerTasks, showToast, t],
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
          task.notificationId = await scheduleTaskReminder(
            task,
            language,
            reminderDeliveryMode,
            alarmPreferences,
          );
        } catch {
          task.notificationId = undefined;
        }
      }
      dispatch({ type: 'upsert_task', payload: task });
      showToast(
        t(
          task.completed ? 'toast.taskCompleted' : 'toast.taskReopened',
          { title: task.title },
        ),
      );
    },
    [
      alarmPreferences,
      dispatch,
      language,
      reminderDeliveryMode,
      showToast,
      t,
    ],
  );

  const completeTask = useCallback(
    async (source: Task) => {
      if (source.completed) return;

      const task: Task = {
        ...source,
        completed: true,
        notificationId: undefined,
        updatedAt: new Date().toISOString(),
      };
      await cancelTaskReminder(source.notificationId);
      dispatch({ type: 'upsert_task', payload: task });
      showToast(t('toast.taskCompleted', { title: task.title }));
    },
    [dispatch, showToast, t],
  );

  return {
    completeTask,
    deleteAllTasks,
    deleteTask,
    duplicateTask,
    saveTask,
    toggleTask,
  };
}
