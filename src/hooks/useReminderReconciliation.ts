import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { Language } from '../i18n/translations';
import { reconcileTaskReminders } from '../services/reminderReconciliation';
import type {
  AlarmSchedulePreferences,
  ReminderDeliveryMode,
  Task,
} from '../types';
import type { PlannerAction } from '../store/plannerReducer';

export function useReminderReconciliation(
  tasks: Task[],
  language: Language,
  reminderDeliveryMode: ReminderDeliveryMode,
  alarmPreferences: AlarmSchedulePreferences,
  enabled: boolean,
  dispatch: (action: PlannerAction) => void,
): void {
  const alarmSoundName = alarmPreferences.soundName;
  const alarmSoundUri = alarmPreferences.soundUri;
  const alarmVibrate = alarmPreferences.vibrate;
  const latestTasksRef = useRef(tasks);
  const languageRef = useRef(language);
  const reminderDeliveryModeRef = useRef(reminderDeliveryMode);
  const alarmPreferencesRef = useRef(alarmPreferences);
  const runningRef = useRef<Promise<void> | undefined>(undefined);

  useEffect(() => {
    latestTasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    reminderDeliveryModeRef.current = reminderDeliveryMode;
  }, [reminderDeliveryMode]);

  useEffect(() => {
    alarmPreferencesRef.current = {
      ...(alarmSoundName ? { soundName: alarmSoundName } : {}),
      ...(alarmSoundUri ? { soundUri: alarmSoundUri } : {}),
      vibrate: alarmVibrate,
    };
  }, [alarmSoundName, alarmSoundUri, alarmVibrate]);

  const reconcile = useCallback(() => {
    if (runningRef.current) return runningRef.current;

    const run = reconcileTaskReminders(
      latestTasksRef.current,
      languageRef.current,
      reminderDeliveryModeRef.current,
      undefined,
      alarmPreferencesRef.current,
    )
      .then((result) => {
        if (result.notificationIdUpdates.length > 0) {
          dispatch({
            type: 'sync_notification_ids',
            payload: result.notificationIdUpdates,
          });
        }
      })
      .catch(() => {
        // The next foreground reconciliation retries transient native failures.
      })
      .finally(() => {
        if (runningRef.current === run) runningRef.current = undefined;
      });
    runningRef.current = run;
    return run;
  }, [dispatch]);

  useEffect(() => {
    if (!enabled) return;
    void reconcile();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void reconcile();
    });
    return () => subscription.remove();
  }, [
    alarmSoundUri,
    alarmSoundName,
    alarmVibrate,
    enabled,
    language,
    reconcile,
    reminderDeliveryMode,
  ]);
}
