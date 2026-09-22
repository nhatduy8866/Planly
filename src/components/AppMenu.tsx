import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useCalendarNavigation } from '../navigation/CalendarNavigationContext';
import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { MOTION } from '../theme/motion';
import { useThemedStyles } from '../theme/useThemedStyles';
import { OnboardingModal } from './OnboardingModal';
import { SettingsModal } from './SettingsModal';
import { UserGuideModal } from './UserGuideModal';

interface AppMenuProps {
  onRequestClose: () => void;
  visible: boolean;
}

export function AppMenu({ onRequestClose, visible }: AppMenuProps) {
  const { mode, setMode } = useCalendarNavigation();
  const {
    colorfulAccents,
    colors,
    language,
    setColorfulAccents,
    setShowTaskBadges,
    showTaskBadges,
    t,
    theme,
    toggleLanguage,
    toggleTheme,
  } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [guideVisible, setGuideVisible] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  function openGuide() {
    onRequestClose();
    setGuideVisible(true);
  }

  function openSettings() {
    onRequestClose();
    setSettingsVisible(true);
  }

  return (
    <>
      {visible ? (
        <View style={styles.dropdown}>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceIcon}>
              <MaterialIcons
                name={mode === 'month' ? 'calendar-month' : 'view-week'}
                size={20}
                color={colors.primaryDark}
              />
            </View>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>{t('menu.calendarView')}</Text>
              <Text style={styles.preferenceValue}>
                {t(mode === 'month' ? 'calendar.month' : 'calendar.week')}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('menu.calendarView')}
              accessibilityRole="switch"
              onValueChange={(monthViewEnabled) => {
                setMode(monthViewEnabled ? 'month' : 'week');
              }}
              thumbColor={colors.white}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={mode === 'month'}
            />
          </View>

          <View style={styles.preferenceRow}>
            <View style={styles.preferenceIcon}>
              <MaterialIcons
                name={theme === 'dark' ? 'dark-mode' : 'light-mode'}
                size={20}
                color={colors.primaryDark}
              />
            </View>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>{t('menu.appearance')}</Text>
              <Text style={styles.preferenceValue}>
                {t(theme === 'dark' ? 'menu.dark' : 'menu.light')}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('settings.appearanceTitle')}
              accessibilityRole="switch"
              onValueChange={() => {
                toggleTheme();
              }}
              thumbColor={colors.white}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={theme === 'dark'}
            />
          </View>

          <View style={styles.preferenceRow}>
            <View style={styles.preferenceIcon}>
              <MaterialIcons name="language" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>{t('menu.language')}</Text>
              <Text style={styles.preferenceValue}>
                {t(language === 'vi' ? 'menu.vietnamese' : 'menu.english')}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('settings.languageTitle')}
              accessibilityRole="switch"
              onValueChange={() => {
                toggleLanguage();
              }}
              thumbColor={colors.white}
              trackColor={{ false: colors.primary, true: colors.primary }}
              value={language === 'en'}
            />
          </View>

          <View style={styles.preferenceRow}>
            <View style={styles.preferenceIcon}>
              <MaterialIcons name="palette" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>{t('menu.colorfulAccents')}</Text>
              <Text style={styles.preferenceValue}>
                {t('menu.colorfulAccentsDescription')}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('menu.colorfulAccents')}
              accessibilityRole="switch"
              onValueChange={(enabled) => {
                setColorfulAccents(enabled);
              }}
              thumbColor={colors.white}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={colorfulAccents}
            />
          </View>

          <View style={styles.preferenceRow}>
            <View style={styles.preferenceIcon}>
              <MaterialIcons name="event-note" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>{t('menu.taskBadges')}</Text>
              <Text style={styles.preferenceValue}>
                {t('menu.taskBadgesDescription')}
              </Text>
            </View>
            <Switch
              accessibilityLabel={t('menu.taskBadges')}
              accessibilityRole="switch"
              onValueChange={(enabled) => {
                setShowTaskBadges(enabled);
              }}
              thumbColor={colors.white}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={showTaskBadges}
            />
          </View>

          <View style={styles.divider} />

          <Pressable
            accessibilityLabel={t('menu.openGuide')}
            accessibilityRole="button"
            onPress={openGuide}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
          >
            <View style={styles.preferenceIcon}>
              <MaterialIcons
                name="help-outline"
                size={20}
                color={colors.primaryDark}
              />
            </View>
            <Text style={styles.settingsText}>{t('guide.title')}</Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>

          <Pressable
            accessibilityLabel={t('menu.openSettings')}
            accessibilityRole="button"
            onPress={openSettings}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}
          >
            <View style={styles.preferenceIcon}>
              <MaterialIcons name="settings" size={20} color={colors.primaryDark} />
            </View>
            <Text style={styles.settingsText}>{t('common.settings')}</Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {settingsVisible ? (
        <SettingsModal
          visible
          onClose={() => setSettingsVisible(false)}
        />
      ) : null}

      <UserGuideModal
        visible={guideVisible}
        onClose={() => setGuideVisible(false)}
        onReplayOnboarding={() => {
          setGuideVisible(false);
          setOnboardingVisible(true);
        }}
      />

      <OnboardingModal
        visible={onboardingVisible}
        onFinish={() => setOnboardingVisible(false)}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dropdown: {
      backgroundColor: colors.surface,
      paddingBottom: 12,
      paddingHorizontal: 16,
    },
    divider: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
      marginVertical: 10,
    },
    preferenceRow: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 54,
    },
    preferenceIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 10,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    preferenceCopy: {
      flex: 1,
      marginLeft: 11,
    },
    preferenceTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    preferenceValue: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    settingsRow: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 46,
    },
    settingsText: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      marginLeft: 11,
    },
    pressed: {
      opacity: MOTION.pressedOpacity,
    },
  });
