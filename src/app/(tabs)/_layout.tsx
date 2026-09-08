import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../../preferences/PreferencesContext';
import type { ThemeColors } from '../../theme/colors';
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

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const bottomInset = Math.max(insets.bottom, 8);

  const label = (text: string, focused: boolean) => (
    <Text style={[styles.label, focused && styles.labelActive]}>{text}</Text>
  );

  return (
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
      <Tabs.Screen
        name="notes"
        options={{
          title: t('nav.notes'),
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="sticky-note-2" />
          ),
          tabBarLabel: ({ focused }) => label(t('nav.notes'), focused),
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  scene: { backgroundColor: colors.background },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  tabBarItem: { gap: 3 },
});
