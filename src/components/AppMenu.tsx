import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { SettingsModal } from './SettingsModal';

interface AppMenuProps {
  onRequestClose: () => void;
  visible: boolean;
}

export function AppMenu({ onRequestClose, visible }: AppMenuProps) {
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
  const [settingsVisible, setSettingsVisible] = useState(false);

  function openSettings() {
    onRequestClose();
    setSettingsVisible(true);
    void Haptics.selectionAsync();
  }

  return (
    <>
      {visible ? (
        <View style={styles.dropdown}>
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
                void Haptics.selectionAsync();
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
                void Haptics.selectionAsync();
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
                void Haptics.selectionAsync();
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
                void Haptics.selectionAsync();
              }}
              thumbColor={colors.white}
              trackColor={{ false: colors.border, true: colors.primary }}
              value={showTaskBadges}
            />
          </View>

          <View style={styles.divider} />

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
      opacity: 0.68,
    },
  });
