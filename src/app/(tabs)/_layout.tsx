import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppNavigationBar } from '../../components/AppNavigationBar';
import {
  AddTaskNavigationProvider,
  useAddTaskNavigation,
} from '../../navigation/AddTaskNavigationContext';
import { CalendarNavigationProvider } from '../../navigation/CalendarNavigationContext';
import { usePreferences } from '../../preferences/PreferencesContext';
import type { ThemeColors } from '../../theme/colors';
import { MOTION } from '../../theme/motion';
import { useThemedStyles } from '../../theme/useThemedStyles';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function TabIcon({ focused, name }: { focused: boolean; name: IconName }) {
  const { colors } = usePreferences();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <MaterialIcons
        name={name}
        size={22}
        color={focused ? colors.primaryDark : colors.textMuted}
      />
    </View>
  );
}

function TabScaffold() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { colors, t } = usePreferences();
  const { requestAddTask } = useAddTaskNavigation();
  const styles = useThemedStyles(createStyles);
  const bottomInset = Math.max(insets.bottom, 8);
  const activeTarget = pathname.startsWith('/tasks') ? 'tasks' : 'schedule';

  const label = (text: string, focused: boolean) => (
    <Text style={[styles.label, focused && styles.labelActive]}>{text}</Text>
  );

  return (
    <View style={styles.layout}>
      <AppNavigationBar />
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          sceneStyle: styles.scene,
          tabBarStyle: [
            styles.tabBar,
            { height: 58 + bottomInset, paddingBottom: bottomInset },
          ],
          tabBarItemStyle: styles.tabBarItem,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('nav.schedule'),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} name="calendar-today" />
            ),
            tabBarLabel: ({ focused }) => label(t('nav.schedule'), focused),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: t('nav.tasks'),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} name="check-circle-outline" />
            ),
            tabBarLabel: ({ focused }) => label(t('nav.tasks'), focused),
          }}
        />
      </Tabs>
      <Pressable
        accessibilityLabel={t('schedule.addTask')}
        accessibilityRole="button"
        hitSlop={6}
        onPress={() => requestAddTask(activeTarget)}
        style={({ pressed }) => [
          styles.addButton,
          { bottom: bottomInset + 4 },
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons color={colors.white} name="add" size={42} />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  return (
    <CalendarNavigationProvider>
      <AddTaskNavigationProvider>
        <TabScaffold />
      </AddTaskNavigationProvider>
    </CalendarNavigationProvider>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 42,
    borderWidth: 4,
    elevation: 8,
    height: 84,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -42,
    position: 'absolute',
    shadowColor: colors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    width: 84,
    zIndex: 20,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 20,
    height: 30,
    justifyContent: 'center',
    width: 54,
  },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  labelActive: { color: colors.primaryDark, fontWeight: '800' },
  layout: { flex: 1 },
  pressed: { opacity: MOTION.pressedOpacity },
  scene: { backgroundColor: colors.background },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  tabBarItem: { gap: 3 },
});
