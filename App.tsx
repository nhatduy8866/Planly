import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomNavigation } from './src/components/BottomNavigation';
import { NotesScreen } from './src/screens/NotesScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { PlannerProvider, usePlanner } from './src/store/PlannerContext';
import { colors } from './src/theme/colors';
import type { RootTab } from './src/types';

function PlanlyApp() {
  const { state } = usePlanner();
  const [activeTab, setActiveTab] = useState<RootTab>('schedule');

  if (!state.hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.screen, activeTab !== 'schedule' && styles.hidden]}>
        <ScheduleScreen />
      </View>
      <View style={[styles.screen, activeTab !== 'tasks' && styles.hidden]}>
        <TasksScreen />
      </View>
      <View style={[styles.screen, activeTab !== 'notes' && styles.hidden]}>
        <NotesScreen />
      </View>
      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PlannerProvider>
        <StatusBar style="dark" />
        <PlanlyApp />
      </PlannerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  screen: { flex: 1 },
  hidden: { display: 'none' },
});
