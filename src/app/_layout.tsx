import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PreferencesProvider, usePreferences } from '../preferences/PreferencesContext';
import { AlarmRingingModal } from '../components/AlarmRingingModal';
import { useAlarmTaskNavigation } from '../hooks/useAlarmTaskNavigation';
import { useNotificationTaskNavigation } from '../hooks/useNotificationTaskNavigation';
import { useReminderReconciliation } from '../hooks/useReminderReconciliation';
import {
  TaskNavigationProvider,
  useTaskNavigation,
} from '../navigation/TaskNavigationContext';
import { initializeNotifications } from '../services/notifications';
import {
  PlannerProvider,
  usePlannerDispatch,
  usePlannerHydrated,
  usePlannerTasks,
} from '../store/PlannerContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

function AppShell() {
  const plannerHydrated = usePlannerHydrated();
  const tasks = usePlannerTasks();
  const dispatch = usePlannerDispatch();
  const {
    alarmBackground,
    alarmSound,
    alarmVibrationEnabled,
    colors,
    hydrated: preferencesHydrated,
    language,
    reminderDeliveryMode,
  } = usePreferences();
  const { requestTask } = useTaskNavigation();
  const styles = useThemedStyles(createStyles);
  const appReady = plannerHydrated && preferencesHydrated;

  const { activeAlarm, dismissAlarm, viewTask } = useAlarmTaskNavigation(
    requestTask,
    appReady,
    tasks,
  );
  useNotificationTaskNavigation(requestTask, appReady);
  useReminderReconciliation(
    tasks,
    language,
    reminderDeliveryMode,
    {
      soundUri: alarmSound?.uri,
      vibrate: alarmVibrationEnabled,
    },
    appReady,
    dispatch,
  );

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
      <AlarmRingingModal
        backgroundUri={alarmBackground?.uri}
        visible={Boolean(activeAlarm)}
        task={activeAlarm?.task}
        onDismiss={dismissAlarm}
        onViewTask={viewTask}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <TaskNavigationProvider>
          <PlannerProvider>
            <AppShell />
          </PlannerProvider>
        </TaskNavigationProvider>
      </PreferencesProvider>
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
