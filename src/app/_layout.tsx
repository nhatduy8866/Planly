import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PreferencesProvider, usePreferences } from '../preferences/PreferencesContext';
import { PlannerProvider, usePlanner } from '../store/PlannerContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

function AppShell() {
  const { state } = usePlanner();
  const { colors, hydrated: preferencesHydrated } = usePreferences();
  const styles = useThemedStyles(createStyles);

  if (!state.hydrated || !preferencesHydrated) {
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
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <PlannerProvider>
          <AppShell />
        </PlannerProvider>
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
