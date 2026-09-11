import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AlarmModalTaskData } from '../components/AlarmRingingModal';
import {
  dismissNativeAlarm,
  getActiveAlarmState,
  subscribeAlarmEvents,
} from '../services/alarms';
import type { Task } from '../types';

export interface ActiveAlarmInfo {
  alarmId: string;
  task: AlarmModalTaskData;
}

export function useAlarmTaskNavigation(
  requestTask: (taskId: string) => void,
  ready: boolean,
  tasks: Task[] = [],
) {
  const router = useRouter();
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarmInfo | null>(null);
  const tasksRef = useRef(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const processingRef = useRef<Promise<void> | undefined>(undefined);

  const checkAlarmState = useCallback(() => {
    if (processingRef.current) return processingRef.current;

    const run = getActiveAlarmState()
      .then((state) => {
        if (!state) {
          setActiveAlarm(null);
          return;
        }

        const matchedTask = state.taskId
          ? tasksRef.current.find((t) => t.id === state.taskId)
          : undefined;

        const taskData: AlarmModalTaskData = {
          color: matchedTask?.color ?? state.color,
          description: matchedTask?.description ?? state.description,
          id: matchedTask?.id ?? state.taskId ?? state.alarmId,
          priority: matchedTask?.priority ?? state.priority ?? 'none',
          startTime: matchedTask?.startTime ?? state.startTime ?? '00:00',
          title: matchedTask?.title ?? state.title ?? 'Báo thức',
        };

        setActiveAlarm({
          alarmId: state.alarmId,
          task: taskData,
        });
      })
      .catch(() => {
        // Native alarm state is reconciled again on the next event.
      })
      .finally(() => {
        if (processingRef.current === run) processingRef.current = undefined;
      });

    processingRef.current = run;
    return run;
  }, []);

  const dismissAlarm = useCallback(async () => {
    if (!activeAlarm) return;
    const currentAlarmId = activeAlarm.alarmId;
    setActiveAlarm(null);
    try {
      await dismissNativeAlarm(currentAlarmId);
    } catch {
      // Ignore dismissal error
    }
  }, [activeAlarm]);

  const viewTask = useCallback(async () => {
    if (!activeAlarm) return;
    const { alarmId, task } = activeAlarm;
    setActiveAlarm(null);
    try {
      await dismissNativeAlarm(alarmId);
    } catch {
      // Ignore dismissal error
    }
    if (task.id) {
      requestTask(task.id);
      router.navigate('/');
    }
  }, [activeAlarm, requestTask, router]);

  useEffect(() => {
    if (!ready) return;
    void checkAlarmState();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkAlarmState();
    });

    const unsubscribeEvents = subscribeAlarmEvents(() => {
      void checkAlarmState();
    });

    return () => {
      appStateSub.remove();
      unsubscribeEvents();
    };
  }, [checkAlarmState, ready]);

  return {
    activeAlarm,
    dismissAlarm,
    viewTask,
  };
}

