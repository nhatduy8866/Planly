import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { consumePendingTaskAlarm } from '../services/alarms';

export function useAlarmTaskNavigation(
  requestTask: (taskId: string) => void,
  ready: boolean,
): void {
  const router = useRouter();
  const processingRef = useRef<Promise<void> | undefined>(undefined);

  const processPendingAlarm = useCallback(() => {
    if (processingRef.current) return processingRef.current;

    const run = consumePendingTaskAlarm()
      .then((alarm) => {
        if (!alarm?.taskId) return;
        requestTask(alarm.taskId);
        router.navigate('/');
      })
      .catch(() => {
        // Native alarm state is reconciled again on the next foreground event.
      })
      .finally(() => {
        if (processingRef.current === run) processingRef.current = undefined;
      });
    processingRef.current = run;
    return run;
  }, [requestTask, router]);

  useEffect(() => {
    if (!ready) return;
    void processPendingAlarm();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void processPendingAlarm();
    });
    return () => subscription.remove();
  }, [processPendingAlarm, ready]);
}
