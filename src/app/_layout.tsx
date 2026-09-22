import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../auth/AuthContext';
import { PreferencesProvider, usePreferences } from '../preferences/PreferencesContext';
import { AlarmRingingModal } from '../components/AlarmRingingModal';
import { AppToastViewport, ToastProvider } from '../components/AppToast';
import { OnboardingModal } from '../components/OnboardingModal';
import { useAlarmTaskNavigation } from '../hooks/useAlarmTaskNavigation';
import { useNotificationTaskNavigation } from '../hooks/useNotificationTaskNavigation';
import { useReminderReconciliation } from '../hooks/useReminderReconciliation';
import { useTodayWidgetSync } from '../hooks/useTodayWidgetSync';
import { useTaskActions } from '../hooks/useTaskActions';
import {
  TaskNavigationProvider,
  useTaskNavigation,
} from '../navigation/TaskNavigationContext';
import { initializeNotifications } from '../services/notifications';
import {
  getAlarmBackgroundAppearance,
  getAlarmBackgroundColor,
  getAlarmBackgroundSource,
  getAlarmSchedulePreferences,
  getAlarmSoundSource,
} from '../services/alarmPresets';
import {
  PlannerProvider,
  usePlannerDispatch,
  usePlannerHydrated,
  usePlannerTasks,
} from '../store/PlannerContext';
import { CloudSyncProvider } from '../sync/CloudSyncContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

function AppShell() {
  const plannerHydrated = usePlannerHydrated();
  const tasks = usePlannerTasks();
  const dispatch = usePlannerDispatch();
  const {
    alarmBackground,
    alarmBackgroundPreset,
    alarmSound,
    alarmSoundPreset,
    alarmVibrationEnabled,
    colors,
    hasSeenOnboarding,
    hydrated: preferencesHydrated,
    language,
    reminderDeliveryMode,
    setHasSeenOnboarding,
    theme,
  } = usePreferences();
  const { requestTask } = useTaskNavigation();
  const { completeTask } = useTaskActions();
  const styles = useThemedStyles(createStyles);
  const appReady = plannerHydrated && preferencesHydrated;
  const alarmPreferences = getAlarmSchedulePreferences(
    alarmSoundPreset,
    alarmSound,
    alarmVibrationEnabled,
  );

  const completeTaskById = useCallback(
    async (taskId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      if (task && !task.completed) await completeTask(task);
    },
    [completeTask, tasks],
  );

  const { activeAlarm, confirmAlarm } = useAlarmTaskNavigation(
    requestTask,
    appReady,
    tasks,
    completeTaskById,
  );
  useNotificationTaskNavigation(requestTask, appReady, completeTaskById);
  useReminderReconciliation(
    tasks,
    language,
    reminderDeliveryMode,
    alarmPreferences,
    appReady,
    dispatch,
  );
  useTodayWidgetSync(tasks, language, theme, appReady);

  useEffect(() => {
    if (!preferencesHydrated) return;
    void initializeNotifications(language).catch(() => {
      // Permission can still be checked or enabled later from Settings.
    });
  }, [language, preferencesHydrated]);

  if (!appReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.outer}>
        <View style={styles.container}>
          <Slot />
        </View>
      </View>
      <OnboardingModal
        visible={!hasSeenOnboarding}
        onFinish={() => setHasSeenOnboarding(true)}
      />
      <AlarmRingingModal
        backgroundAppearance={getAlarmBackgroundAppearance(
          alarmBackgroundPreset,
          alarmBackground,
        )}
        backgroundSource={getAlarmBackgroundSource(
          alarmBackgroundPreset,
          alarmBackground,
        )}
        backgroundColor={getAlarmBackgroundColor(
          alarmBackgroundPreset,
          alarmBackground,
        )}
        soundSource={getAlarmSoundSource(
          alarmSoundPreset,
          alarmSound,
        )}
        vibrate={alarmVibrationEnabled}
        visible={Boolean(activeAlarm)}
        task={activeAlarm?.task}
        onDismiss={confirmAlarm}
      />
      <AppToastViewport />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PreferencesProvider>
          <ToastProvider>
            <TaskNavigationProvider>
              <PlannerProvider>
                <CloudSyncProvider>
                  <AppShell />
                </CloudSyncProvider>
              </PlannerProvider>
            </TaskNavigationProvider>
          </ToastProvider>
        </PreferencesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  outer: {
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? colors.surfaceMuted : colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
  },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
