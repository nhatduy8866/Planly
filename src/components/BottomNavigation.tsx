import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import type { RootTab } from '../types';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const tabs: { key: RootTab; label: string; icon: IconName }[] = [
  { key: 'schedule', label: 'Lịch', icon: 'calendar-today' },
  { key: 'tasks', label: 'Công việc', icon: 'check-circle-outline' },
  { key: 'notes', label: 'Ghi chú', icon: 'sticky-note-2' },
];

export function BottomNavigation({
  activeTab,
  onChange,
}: {
  activeTab: RootTab;
  onChange: (tab: RootTab) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <MaterialIcons
                name={tab.icon}
                size={22}
                color={active ? colors.primaryDark : colors.textMuted}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingTop: 8,
  },
  tab: { alignItems: 'center', flex: 1, gap: 3 },
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
  pressed: { opacity: 0.65 },
});
