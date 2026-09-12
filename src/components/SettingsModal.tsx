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
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../preferences/PreferencesContext';
import {
  AlarmMediaError,
  pickAlarmMedia,
  type AlarmMediaKind,
} from '../services/alarmMedia';
import {
  getAlarmPermission,
  openAlarmSettings,
  openFullScreenAlarmSettings,
  requestAlarmPermission,
  type AlarmPermissionSummary,
} from '../services/alarms';
import {
  getNotificationPermission,
  openNotificationSettings,
  requestNotificationPermission,
  type NotificationPermissionSummary,
} from '../services/notifications';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ReminderDeliveryMode } from '../types';
import { IconButton } from './IconButton';

type SettingsPicker = 'background' | 'delivery' | 'sound' | 'vibration';
type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

interface PickerOption {
  disabled?: boolean;
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
}

interface SettingRowOptions {
  icon: MaterialIconName;
  label: string;
  onPress?: () => void;
  value: string;
}

interface SettingsModalProps {
  onClose: () => void;
  visible: boolean;
}

export function SettingsModal({ onClose, visible }: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const {
    alarmBackground,
    alarmSound,
    alarmVibrationEnabled,
    colors,
    language,
    reminderDeliveryMode,
    setAlarmBackground,
    setAlarmSound,
    setAlarmVibrationEnabled,
    setReminderDeliveryMode,
    t,
  } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [activePicker, setActivePicker] = useState<SettingsPicker | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionSummary | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationCheckFailed, setNotificationCheckFailed] = useState(false);
  const [alarmPermission, setAlarmPermission] =
    useState<AlarmPermissionSummary | null>(null);
  const [alarmBusy, setAlarmBusy] = useState(false);
  const [alarmMediaBusy, setAlarmMediaBusy] =
    useState<AlarmMediaKind | null>(null);
  const [alarmMediaError, setAlarmMediaError] = useState<string | null>(null);

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

  const refreshAlarmPermission = useCallback(async () => {
    setAlarmPermission(await getAlarmPermission());
  }, []);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void refreshNotificationPermission();
      if (reminderDeliveryMode === 'alarm') {
        void refreshAlarmPermission();
      }
    });
    return () => subscription.remove();
  }, [
    refreshAlarmPermission,
    refreshNotificationPermission,
    reminderDeliveryMode,
    visible,
  ]);

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

  async function handleReminderDeliveryMode(mode: ReminderDeliveryMode) {
    setActivePicker(null);
    setReminderDeliveryMode(mode);
    void Haptics.selectionAsync();
    if (mode !== 'alarm' || alarmBusy) return;

    setAlarmBusy(true);
    try {
      setAlarmPermission(await requestAlarmPermission());
    } finally {
      setAlarmBusy(false);
    }
  }

  async function handleAlarmAccess() {
    if (!alarmPermission || alarmBusy) return;
    setAlarmBusy(true);
    try {
      if (!alarmPermission.canScheduleExactAlarms) {
        await openAlarmSettings();
      } else if (!alarmPermission.canUseFullScreenIntent) {
        await openFullScreenAlarmSettings();
      }
    } finally {
      setAlarmBusy(false);
    }
  }

  async function handleAlarmMediaPick(kind: AlarmMediaKind) {
    if (alarmMediaBusy) return;
    setActivePicker(null);
    setAlarmMediaBusy(kind);
    setAlarmMediaError(null);
    try {
      const file = await pickAlarmMedia(kind);
      if (!file) return;
      if (kind === 'sound') {
        setAlarmSound(file);
      } else {
        setAlarmBackground(file);
      }
      void Haptics.selectionAsync();
    } catch (error) {
      setAlarmMediaError(
        t(
          error instanceof AlarmMediaError && error.reason === 'fileTooLarge'
            ? 'settings.alarmMediaFileTooLarge'
            : 'settings.alarmMediaUnavailable',
        ),
      );
    } finally {
      setAlarmMediaBusy(null);
    }
  }

  function setDefaultAlarmMedia(kind: AlarmMediaKind) {
    setActivePicker(null);
    if (kind === 'sound') {
      setAlarmSound(null);
    } else {
      setAlarmBackground(null);
    }
    setAlarmMediaError(null);
    void Haptics.selectionAsync();
  }

  function setVibration(enabled: boolean) {
    setActivePicker(null);
    setAlarmVibrationEnabled(enabled);
    void Haptics.selectionAsync();
  }

  function closeSettings() {
    setActivePicker(null);
    onClose();
  }

  const notificationStatus = notificationCheckFailed
    ? t('settings.statusUnavailable')
    : !notificationPermission
      ? t('settings.statusChecking')
      : notificationPermission.state === 'granted'
        ? t('settings.statusEnabled')
        : notificationPermission.state === 'unsupported'
          ? t('settings.statusUnsupported')
          : t('settings.statusDisabled');
  const canChangeNotificationPermission =
    notificationPermission !== null &&
    notificationPermission.state !== 'granted' &&
    notificationPermission.state !== 'unsupported';
  const alarmStatus = !alarmPermission
    ? t('settings.statusChecking')
    : !alarmPermission.available
      ? t('settings.statusUnsupported')
      : !alarmPermission.canScheduleExactAlarms ||
          !alarmPermission.canPostNotifications ||
          !alarmPermission.canUseFullScreenIntent
        ? t('settings.statusNeedsAccess')
        : t('settings.statusReady');
  const canChangeAlarmAccess =
    alarmPermission?.available &&
    (!alarmPermission.canScheduleExactAlarms ||
      !alarmPermission.canUseFullScreenIntent);

  let pickerTitle = '';
  let pickerOptions: PickerOption[] = [];

  if (activePicker === 'delivery') {
    pickerTitle = t('settings.reminderTypeTitle');
    pickerOptions = [
      {
        icon: 'notifications',
        label: t('settings.reminderTypeNotification'),
        onPress: () => void handleReminderDeliveryMode('notification'),
        selected: reminderDeliveryMode === 'notification',
      },
      {
        disabled: Platform.OS === 'web',
        icon: 'alarm',
        label: t('settings.reminderTypeAlarm'),
        onPress: () => void handleReminderDeliveryMode('alarm'),
        selected: reminderDeliveryMode === 'alarm',
      },
    ];
  } else if (activePicker === 'vibration') {
    pickerTitle = t('settings.alarmVibrationTitle');
    pickerOptions = [
      {
        icon: 'vibration',
        label: t('settings.alarmVibrationEnabled'),
        onPress: () => setVibration(true),
        selected: alarmVibrationEnabled,
      },
      {
        icon: 'phone-android',
        label: t('settings.alarmVibrationDisabled'),
        onPress: () => setVibration(false),
        selected: !alarmVibrationEnabled,
      },
    ];
  } else if (activePicker === 'sound') {
    pickerTitle = t('settings.alarmSoundTitle');
    pickerOptions = [
      {
        icon: 'notifications-active',
        label: t('settings.alarmSoundDefault'),
        onPress: () => setDefaultAlarmMedia('sound'),
        selected: alarmSound === null,
      },
      ...(alarmSound
        ? [
            {
              icon: 'audio-file' as const,
              label: alarmSound.name,
              onPress: () => setActivePicker(null),
              selected: true,
            },
          ]
        : []),
      {
        disabled: Platform.OS === 'web' || alarmMediaBusy !== null,
        icon: 'upload-file',
        label: t('settings.alarmSoundUpload'),
        onPress: () => void handleAlarmMediaPick('sound'),
      },
    ];
  } else if (activePicker === 'background') {
    pickerTitle = t('settings.alarmBackgroundTitle');
    pickerOptions = [
      {
        icon: 'wallpaper',
        label: t('settings.alarmBackgroundDefault'),
        onPress: () => setDefaultAlarmMedia('background'),
        selected: alarmBackground === null,
      },
      ...(alarmBackground
        ? [
            {
              icon: 'image' as const,
              label: alarmBackground.name,
              onPress: () => setActivePicker(null),
              selected: true,
            },
          ]
        : []),
      {
        disabled: Platform.OS === 'web' || alarmMediaBusy !== null,
        icon: 'upload-file',
        label: t('settings.alarmBackgroundUpload'),
        onPress: () => void handleAlarmMediaPick('background'),
      },
    ];
  }

  function renderSettingRow({ icon, label, onPress, value }: SettingRowOptions) {
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityState={{ disabled: !onPress }}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.settingRow,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.settingIcon}>
          <MaterialIcons name={icon} size={21} color={colors.primaryDark} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
        <View style={styles.settingValueWrap}>
          <Text numberOfLines={1} style={styles.settingValue}>
            {value}
          </Text>
          {onPress ? (
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={colors.textMuted}
            />
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <Modal
        animationType="slide"
        onShow={() => {
          void refreshNotificationPermission();
          if (reminderDeliveryMode === 'alarm') {
            void refreshAlarmPermission();
          }
        }}
        onRequestClose={closeSettings}
        transparent={Platform.OS === 'web'}
        visible={visible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View
              style={[
                styles.floatingClose,
                {
                  top:
                    Platform.OS === 'web' ? 12 : Math.max(insets.top + 4, 16),
                },
              ]}
            >
              <IconButton
                accessibilityLabel={t('common.close')}
                backgroundColor={colors.surface}
                icon="close"
                onPress={closeSettings}
              />
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.modalContent,
                {
                  paddingTop:
                    Platform.OS === 'web'
                      ? 70
                      : Math.max(insets.top + 64, 84),
                },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {renderSettingRow({
                icon:
                  reminderDeliveryMode === 'alarm' ? 'alarm' : 'notifications',
                label: t('settings.reminderTypeTitle'),
                onPress: () => setActivePicker('delivery'),
                value: t(
                  reminderDeliveryMode === 'alarm'
                    ? 'settings.reminderTypeAlarm'
                    : 'settings.reminderTypeNotification',
                ),
              })}

              {reminderDeliveryMode === 'alarm' ? (
                <>
                  {renderSettingRow({
                    icon: 'vibration',
                    label: t('settings.alarmVibrationTitle'),
                    onPress: () => setActivePicker('vibration'),
                    value: t(
                      alarmVibrationEnabled
                        ? 'settings.alarmVibrationEnabled'
                        : 'settings.alarmVibrationDisabled',
                    ),
                  })}
                  {renderSettingRow({
                    icon: 'audio-file',
                    label: t('settings.alarmSoundTitle'),
                    onPress: () => setActivePicker('sound'),
                    value:
                      alarmSound?.name ?? t('settings.alarmSoundDefault'),
                  })}
                  {renderSettingRow({
                    icon: 'image',
                    label: t('settings.alarmBackgroundTitle'),
                    onPress: () => setActivePicker('background'),
                    value:
                      alarmBackground?.name ??
                      t('settings.alarmBackgroundDefault'),
                  })}
                </>
              ) : null}

              {renderSettingRow({
                icon: 'notifications-active',
                label: t('settings.notificationsTitle'),
                onPress: canChangeNotificationPermission
                  ? () => void handleNotificationPermission()
                  : undefined,
                value: notificationBusy
                  ? t('settings.statusChecking')
                  : notificationStatus,
              })}

              {reminderDeliveryMode === 'alarm'
                ? renderSettingRow({
                    icon: 'alarm-on',
                    label: t('settings.alarmAccessTitle'),
                    onPress: canChangeAlarmAccess
                      ? () => void handleAlarmAccess()
                      : undefined,
                    value: alarmBusy ? t('settings.statusChecking') : alarmStatus,
                  })
                : null}

              {alarmMediaError ? (
                <View style={styles.mediaError}>
                  <MaterialIcons
                    name="error-outline"
                    size={18}
                    color={colors.danger}
                  />
                  <Text style={styles.mediaErrorText}>{alarmMediaError}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
        transparent
        visible={activePicker !== null}
      >
        <Pressable
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
          onPress={() => setActivePicker(null)}
          style={styles.pickerBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.pickerCard,
              {
                paddingBottom:
                  Platform.OS === 'web' ? 20 : Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <IconButton
                accessibilityLabel={t('common.close')}
                backgroundColor={colors.surfaceMuted}
                icon="close"
                onPress={() => setActivePicker(null)}
              />
            </View>
            <View style={styles.pickerOptions}>
              {pickerOptions.map((option, index) => (
                <Pressable
                  key={`${option.label}-${index}`}
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{
                    disabled: option.disabled,
                    selected: option.selected,
                  }}
                  disabled={option.disabled}
                  onPress={option.onPress}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    option.selected && styles.pickerOptionSelected,
                    option.disabled && styles.pickerOptionDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons
                    name={option.icon}
                    size={22}
                    color={
                      option.selected ? colors.primaryDark : colors.textMuted
                    }
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.pickerOptionText,
                      option.selected && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.selected ? (
                    <MaterialIcons
                      name="check-circle"
                      size={21}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    floatingClose: {
      left: 14,
      position: 'absolute',
      zIndex: 2,
    },
    modalContent: {
      gap: 10,
      paddingBottom: 48,
      paddingHorizontal: 16,
    },
    settingRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 60,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    settingIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 10,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    settingLabel: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
    },
    settingValueWrap: {
      alignItems: 'center',
      flexDirection: 'row',
      maxWidth: '48%',
    },
    settingValue: {
      color: colors.textMuted,
      flexShrink: 1,
      fontSize: 13,
      textAlign: 'right',
    },
    mediaError: {
      alignItems: 'center',
      backgroundColor: colors.dangerSoft,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 8,
      padding: 10,
    },
    mediaErrorText: {
      color: colors.danger,
      flex: 1,
      fontSize: 12,
    },
    pickerBackdrop: {
      alignItems: 'center',
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    },
    pickerCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: Platform.OS === 'web' ? 20 : 24,
      borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
      borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
      borderWidth: 1,
      maxWidth: 480,
      paddingHorizontal: 16,
      paddingTop: 14,
      width: Platform.OS === 'web' ? '92%' : '100%',
    },
    pickerHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      marginBottom: 10,
    },
    pickerTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      marginLeft: 4,
    },
    pickerOptions: {
      gap: 8,
    },
    pickerOption: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 13,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 11,
      minHeight: 54,
      paddingHorizontal: 14,
    },
    pickerOptionSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    pickerOptionDisabled: {
      opacity: 0.45,
    },
    pickerOptionText: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
    },
    pickerOptionTextSelected: {
      color: colors.primaryDark,
      fontWeight: '800',
    },
    pressed: {
      opacity: 0.68,
    },
  });
