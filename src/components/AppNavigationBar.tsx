import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCalendarNavigation } from '../navigation/CalendarNavigationContext';
import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AppMenu } from './AppMenu';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function getRouteIcon(pathname: string): IconName {
  if (pathname === '/tasks') return 'check-circle-outline';
  if (pathname === '/notes') return 'sticky-note-2';
  return 'calendar-month';
}

export function AppNavigationBar() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { mode, requestToday, setMode } = useCalendarNavigation();
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const isSchedule = pathname === '/';

  return (
    <View style={[styles.navigationShell, { paddingTop: insets.top }]}>
      <View style={styles.navigationBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(menuExpanded ? 'menu.close' : 'menu.open')}
          accessibilityState={{ expanded: menuExpanded }}
          onPress={() => {
            setMenuExpanded((expanded) => !expanded);
            void Haptics.selectionAsync();
          }}
          style={({ pressed }) => [
            styles.menuButton,
            menuExpanded && styles.menuButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <MaterialIcons name="menu" size={25} color={colors.primaryDark} />
        </Pressable>

        <View pointerEvents="none" style={styles.centerIconWrap}>
          <View style={styles.centerIcon}>
            <MaterialIcons
              name={getRouteIcon(pathname)}
              size={23}
              color={colors.primaryDark}
            />
          </View>
        </View>

        {isSchedule ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('schedule.today')}
            onPress={requestToday}
            style={({ pressed }) => [styles.todayButton, pressed && styles.pressed]}
          >
            <Text style={styles.todayText}>{t('schedule.today')}</Text>
          </Pressable>
        ) : (
          <View style={styles.actionSpacer} />
        )}
      </View>

      <AppMenu
        mode={mode}
        onModeChange={setMode}
        onRequestClose={() => setMenuExpanded(false)}
        visible={menuExpanded}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  actionSpacer: { height: 38, width: 38 },
  centerIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 11,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  centerIconWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  menuButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  menuButtonActive: { backgroundColor: colors.surfaceMuted },
  navigationBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  navigationShell: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    zIndex: 10,
  },
  pressed: { opacity: 0.7 },
  todayButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  todayText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
});
