import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../preferences/PreferencesContext';
import {
  getNotificationPermission,
  openNotificationSettings,
  requestNotificationPermission,
  type NotificationPermissionSummary,
} from '../services/notifications';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { IconButton } from './IconButton';

interface AppMenuProps {
  onRequestClose: () => void;
  visible: boolean;
}

export function AppMenu({
  onRequestClose,
  visible,
}: AppMenuProps) {
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

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </>
  );
}

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors, language, setLanguage, setTheme, t, theme } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionSummary | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationCheckFailed, setNotificationCheckFailed] = useState(false);

  const refreshNotificationPermission = useCallback(async () => {
    try {
      const permission = await getNotificationPermission(language);
      setNotificationPermission(permission);
      setNotificationCheckFailed(false);
    } catch {
      setNotificationPermission(null);
      setNotificationCheckFailed(true);
    }
  }, [language]);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshNotificationPermission();
    });
    return () => subscription.remove();
  }, [refreshNotificationPermission, visible]);

  async function handleNotificationPermission() {
    if (!notificationPermission || notificationBusy) return;
    setNotificationBusy(true);
    try {
      if (
        notificationPermission.state === 'denied' &&
        !notificationPermission.canAskAgain
      ) {
        await openNotificationSettings();
      } else {
        setNotificationPermission(await requestNotificationPermission(language));
      }
      setNotificationCheckFailed(false);
    } catch {
      setNotificationCheckFailed(true);
    } finally {
      setNotificationBusy(false);
    }
  }

  const notificationStatusKey = notificationCheckFailed
    ? 'settings.notificationsUnavailable'
    : notificationPermission
      ? `settings.notifications${
          notificationPermission.state === 'granted'
            ? 'Granted'
            : notificationPermission.state === 'denied'
              ? 'Denied'
              : notificationPermission.state === 'undetermined'
                ? 'Undetermined'
                : 'Unsupported'
        }` as const
      : 'settings.notificationsChecking';
  const notificationActionLabel =
    notificationPermission?.state === 'denied' && !notificationPermission.canAskAgain
      ? t('settings.notificationsOpen')
      : t('settings.notificationsEnable');
  const canChangeNotificationPermission =
    notificationPermission !== null &&
    notificationPermission.state !== 'granted' &&
    notificationPermission.state !== 'unsupported';

  return (
    <Modal
      animationType="slide"
      onShow={() => void refreshNotificationPermission()}
      onRequestClose={onClose}
      transparent={Platform.OS === 'web'}
      visible={visible}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View
            style={[
              styles.modalHeader,
              { paddingTop: Platform.OS === 'web' ? 16 : Math.max(insets.top, 16) },
            ]}
          >
            <IconButton
              accessibilityLabel={t('common.close')}
              backgroundColor="transparent"
              icon="close"
              onPress={onClose}
            />
            <Text style={styles.modalTitle}>{t('settings.title')}</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.settingsHeroIcon}>
              <MaterialIcons name="tune" size={27} color={colors.primaryDark} />
            </View>
            <Text style={styles.settingsHeading}>{t('settings.title')}</Text>
            <Text style={styles.settingsSubtitle}>{t('settings.subtitle')}</Text>

            <Text style={styles.cardLabel}>{t('settings.appearanceTitle')}</Text>
            <Text style={styles.cardDescription}>
              {t('settings.appearanceDescription')}
            </Text>
            <View style={styles.choiceGroup}>
              {(['light', 'dark'] as const).map((item) => {
                const selected = theme === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setTheme(item);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.choice,
                      selected && styles.choiceSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialIcons
                      name={item === 'light' ? 'light-mode' : 'dark-mode'}
                      size={21}
                      color={selected ? colors.primaryDark : colors.textMuted}
                    />
                    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                      {t(item === 'light' ? 'menu.light' : 'menu.dark')}
                    </Text>
                    {selected ? (
                      <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.cardLabel, styles.secondCardLabel]}>
              {t('settings.languageTitle')}
            </Text>
            <Text style={styles.cardDescription}>
              {t('settings.languageDescription')}
            </Text>
            <View style={styles.choiceGroup}>
              {(['vi', 'en'] as const).map((item) => {
                const selected = language === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setLanguage(item);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.choice,
                      selected && styles.choiceSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialIcons name="language" size={21} color={selected ? colors.primaryDark : colors.textMuted} />
                    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                      {t(item === 'vi' ? 'menu.vietnamese' : 'menu.english')}
                    </Text>
                    {selected ? (
                      <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.cardLabel, styles.secondCardLabel]}>
              {t('settings.notificationsTitle')}
            </Text>
            <Text style={styles.cardDescription}>
              {t('settings.notificationsDescription')}
            </Text>
            <View style={styles.notificationCard}>
              <View
                style={[
                  styles.notificationIcon,
                  notificationPermission?.state === 'granted' &&
                    styles.notificationIconGranted,
                ]}
              >
                <MaterialIcons
                  name={
                    notificationPermission?.state === 'granted'
                      ? 'notifications-active'
                      : 'notifications-none'
                  }
                  size={22}
                  color={
                    notificationPermission?.state === 'granted'
                      ? colors.primary
                      : colors.textMuted
                  }
                />
              </View>
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationStatus}>
                  {t(notificationStatusKey)}
                </Text>
                {canChangeNotificationPermission ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: notificationBusy }}
                    disabled={notificationBusy}
                    onPress={() => void handleNotificationPermission()}
                    style={({ pressed }) => [
                      styles.notificationAction,
                      (pressed || notificationBusy) && styles.pressed,
                    ]}
                  >
                    <Text style={styles.notificationActionText}>
                      {notificationActionLabel}
                    </Text>
                    <MaterialIcons
                      name={
                        notificationPermission?.canAskAgain === false
                          ? 'open-in-new'
                          : 'chevron-right'
                      }
                      size={18}
                      color={colors.primaryDark}
                    />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.savedNote}>
              <MaterialIcons name="cloud-done" size={18} color={colors.primary} />
              <Text style={styles.savedNoteText}>{t('settings.saved')}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: Platform.OS === 'web' ? colors.overlay : colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: Platform.OS === 'web' ? 24 : 0,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    flex: Platform.OS === 'web' ? undefined : 1,
    height: Platform.OS === 'web' ? '82%' : '100%',
    maxHeight: Platform.OS === 'web' ? 680 : undefined,
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    overflow: 'hidden',
    width: Platform.OS === 'web' ? '92%' : '100%',
  },
  modalHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  modalTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: {
    height: 40,
    width: 40,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 48,
  },
  settingsHeroIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  settingsHeading: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  settingsSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
    marginTop: 6,
    textAlign: 'center',
  },
  cardLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  secondCardLabel: {
    marginTop: 24,
  },
  cardDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    marginTop: 4,
  },
  choiceGroup: {
    gap: 8,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  choiceSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  choiceText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceTextSelected: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  notificationCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  notificationIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 11,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  notificationIconGranted: {
    backgroundColor: colors.primarySoft,
  },
  notificationCopy: {
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  notificationStatus: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  notificationAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginTop: 7,
    minHeight: 28,
  },
  notificationActionText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '800',
  },
  savedNote: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
    padding: 12,
  },
  savedNoteText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.68,
  },
});
