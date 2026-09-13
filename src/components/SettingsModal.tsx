import { MaterialIcons } from '@expo/vector-icons';
import {
  setAudioModeAsync,
  type AudioPlayer,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Image,
  ImageBackground,
  type ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { usePreferences } from '../preferences/PreferencesContext';
import {
  ALARM_BACKGROUND_PRESETS,
  ALARM_SOUND_PRESETS,
  DEFAULT_ALARM_BACKGROUND_PRESET,
  DEFAULT_ALARM_SOUND_PRESET,
  getAlarmBackgroundPreset,
  getAlarmSoundPreset,
} from '../services/alarmPresets';
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
import { useCloudSync } from '../sync/CloudSyncContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type {
  AlarmBackgroundPresetId,
  AlarmSoundPresetId,
  ReminderDeliveryMode,
} from '../types';
import { AccountSyncModal } from './AccountSyncModal';
import { IconButton } from './IconButton';

type SettingsPicker = 'background' | 'delivery' | 'sound' | 'vibration';
type MaterialIconName = keyof typeof MaterialIcons.glyphMap;

interface PickerOption {
  disabled?: boolean;
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
  preview?:
    | { kind: 'background'; source: ImageSourcePropType }
    | { key: string; kind: 'sound'; source: number | string };
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

function configurePreviewPlayer(player: AudioPlayer): void {
  player.loop = false;
  player.volume = 0.8;
}

function pausePreviewPlayer(player: AudioPlayer): void {
  try {
    player.pause();
  } catch {
    // Expo releases shared audio objects during unmount and Fast Refresh.
  }
}

export function SettingsModal({ onClose, visible }: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { configured: syncConfigured, user } = useAuth();
  const { status: syncStatus } = useCloudSync();
  const {
    alarmBackground,
    alarmBackgroundPreset = DEFAULT_ALARM_BACKGROUND_PRESET,
    alarmSound,
    alarmSoundPreset = DEFAULT_ALARM_SOUND_PRESET,
    alarmVibrationEnabled,
    colors,
    language,
    reminderDeliveryMode,
    setAlarmBackground,
    setAlarmBackgroundPreset,
    setAlarmSound,
    setAlarmSoundPreset,
    setAlarmVibrationEnabled,
    setReminderDeliveryMode,
    t,
  } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const previewPlayer = useAudioPlayer(null);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  const [accountSyncVisible, setAccountSyncVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<SettingsPicker | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<{
    label: string;
    source: ImageSourcePropType;
  } | null>(null);
  const [previewingSoundKey, setPreviewingSoundKey] = useState<string | null>(
    null,
  );
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

  useEffect(() => {
    if (activePicker === 'sound') return;
    pausePreviewPlayer(previewPlayer);
  }, [activePicker, previewPlayer]);

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

  function closePicker() {
    pausePreviewPlayer(previewPlayer);
    setPreviewingSoundKey(null);
    setActivePicker(null);
  }

  async function handleReminderDeliveryMode(mode: ReminderDeliveryMode) {
    closePicker();
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
    closePicker();
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
      setActivePicker(kind);
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

  function selectAlarmSoundPreset(preset: AlarmSoundPresetId) {
    closePicker();
    setAlarmSound(null);
    setAlarmSoundPreset(preset);
    setAlarmMediaError(null);
    void Haptics.selectionAsync();
  }

  function selectAlarmBackgroundPreset(preset: AlarmBackgroundPresetId) {
    closePicker();
    setAlarmBackground(null);
    setAlarmBackgroundPreset(preset);
    setAlarmMediaError(null);
    void Haptics.selectionAsync();
  }

  async function previewAlarmSound(
    key: string,
    source: number | string,
  ) {
    if (previewingSoundKey === key && previewStatus.playing) {
      pausePreviewPlayer(previewPlayer);
      await previewPlayer.seekTo(0);
      setPreviewingSoundKey(null);
      return;
    }

    pausePreviewPlayer(previewPlayer);
    previewPlayer.replace(source);
    configurePreviewPlayer(previewPlayer);
    setPreviewingSoundKey(key);
    try {
      await setAudioModeAsync({
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
      });
      previewPlayer.play();
    } catch {
      setPreviewingSoundKey(null);
      setAlarmMediaError(t('settings.alarmMediaUnavailable'));
    }
  }

  function setVibration(enabled: boolean) {
    closePicker();
    setAlarmVibrationEnabled(enabled);
    void Haptics.selectionAsync();
  }

  function closeSettings() {
    closePicker();
    setAccountSyncVisible(false);
    setBackgroundPreview(null);
    onClose();
  }

  const selectedAlarmSoundLabel = alarmSound
    ? alarmSound.name
    : t(getAlarmSoundPreset(alarmSoundPreset).labelKey);
  const selectedAlarmBackgroundLabel = alarmBackground
    ? alarmBackground.name
    : t(getAlarmBackgroundPreset(alarmBackgroundPreset).labelKey);

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
  const syncStatusLabel = !syncConfigured
    ? t('sync.statusDisabled')
    : !user
      ? t('sync.statusSignedOut')
      : t(
          syncStatus === 'error'
            ? 'sync.statusError'
            : syncStatus === 'pending'
              ? 'sync.statusPending'
              : syncStatus === 'syncing'
                ? 'sync.statusSyncing'
                : 'sync.statusSynced',
        );

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
      ...ALARM_SOUND_PRESETS.map((preset) => ({
        icon: 'notifications-active' as const,
        label: t(preset.labelKey),
        onPress: () => selectAlarmSoundPreset(preset.id),
        preview: {
          key: `preset:${preset.id}`,
          kind: 'sound' as const,
          source: preset.source,
        },
        selected: alarmSound === null && alarmSoundPreset === preset.id,
      })),
      {
        disabled: Platform.OS === 'web' || alarmMediaBusy !== null,
        icon: 'upload-file',
        label: alarmSound?.name ?? t('settings.alarmSoundUpload'),
        onPress: () => void handleAlarmMediaPick('sound'),
        preview: alarmSound
          ? {
              key: `upload:${alarmSound.uri}`,
              kind: 'sound',
              source: alarmSound.uri,
            }
          : undefined,
        selected: alarmSound !== null,
      },
    ];
  } else if (activePicker === 'background') {
    pickerTitle = t('settings.alarmBackgroundTitle');
    pickerOptions = [
      ...ALARM_BACKGROUND_PRESETS.map((preset) => ({
        icon: 'wallpaper' as const,
        label: t(preset.labelKey),
        onPress: () => selectAlarmBackgroundPreset(preset.id),
        preview: {
          kind: 'background' as const,
          source: preset.source,
        },
        selected:
          alarmBackground === null && alarmBackgroundPreset === preset.id,
      })),
      {
        disabled: Platform.OS === 'web' || alarmMediaBusy !== null,
        icon: 'upload-file',
        label: alarmBackground?.name ?? t('settings.alarmBackgroundUpload'),
        onPress: () => void handleAlarmMediaPick('background'),
        preview: alarmBackground
          ? { kind: 'background', source: { uri: alarmBackground.uri } }
          : undefined,
        selected: alarmBackground !== null,
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
                icon: user ? 'cloud-done' : 'cloud-sync',
                label: t('sync.title'),
                onPress: () => setAccountSyncVisible(true),
                value: syncStatusLabel,
              })}

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
                    value: selectedAlarmSoundLabel,
                  })}
                  {renderSettingRow({
                    icon: 'image',
                    label: t('settings.alarmBackgroundTitle'),
                    onPress: () => setActivePicker('background'),
                    value: selectedAlarmBackgroundLabel,
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

      <AccountSyncModal
        onClose={() => setAccountSyncVisible(false)}
        visible={accountSyncVisible}
      />

      <Modal
        animationType="fade"
        onRequestClose={closePicker}
        transparent
        visible={activePicker !== null}
      >
        <Pressable
          accessibilityLabel={t('common.close')}
          accessibilityRole="button"
          onPress={closePicker}
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
                onPress={closePicker}
              />
            </View>
            <ScrollView
              contentContainerStyle={styles.pickerOptions}
              showsVerticalScrollIndicator={false}
              style={styles.pickerOptionsScroll}
            >
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
                  {option.preview?.kind === 'background' ? (
                    <Image
                      source={option.preview.source}
                      style={styles.backgroundThumbnail}
                    />
                  ) : (
                    <MaterialIcons
                      name={option.icon}
                      size={22}
                      color={
                        option.selected ? colors.primaryDark : colors.textMuted
                      }
                    />
                  )}
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.pickerOptionText,
                      option.selected && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.preview ? (
                    <Pressable
                      accessibilityLabel={t(
                        option.preview.kind === 'sound' &&
                          previewingSoundKey === option.preview.key &&
                          previewStatus.playing
                          ? 'settings.alarmPreviewStop'
                          : option.preview.kind === 'sound'
                            ? 'settings.alarmPreviewPlay'
                            : 'settings.alarmPreviewImage',
                        { name: option.label },
                      )}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        if (option.preview?.kind === 'sound') {
                          void previewAlarmSound(
                            option.preview.key,
                            option.preview.source,
                          );
                        } else if (option.preview?.kind === 'background') {
                          setBackgroundPreview({
                            label: option.label,
                            source: option.preview.source,
                          });
                        }
                      }}
                      style={({ pressed }) => [
                        styles.previewButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialIcons
                        name={
                          option.preview.kind === 'sound' &&
                          previewingSoundKey === option.preview.key &&
                          previewStatus.playing
                            ? 'stop-circle'
                            : option.preview.kind === 'sound'
                              ? 'play-circle'
                              : 'visibility'
                        }
                        size={24}
                        color={colors.primary}
                      />
                    </Pressable>
                  ) : null}
                  {option.selected ? (
                    <MaterialIcons
                      name="check-circle"
                      size={21}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setBackgroundPreview(null)}
        transparent
        visible={backgroundPreview !== null}
      >
        <View style={styles.backgroundPreviewBackdrop}>
          {backgroundPreview ? (
            <ImageBackground
              resizeMode="cover"
              source={backgroundPreview.source}
              style={styles.backgroundPreviewImage}
            >
              <View
                style={[
                  styles.backgroundPreviewOverlay,
                  { paddingTop: Math.max(insets.top, 18) },
                ]}
              >
                <Text style={styles.backgroundPreviewTitle}>
                  {backgroundPreview.label}
                </Text>
                <IconButton
                  accessibilityLabel={t('settings.alarmPreviewClose')}
                  backgroundColor="rgba(9, 13, 22, 0.72)"
                  color="#FFFFFF"
                  icon="close"
                  onPress={() => setBackgroundPreview(null)}
                />
              </View>
            </ImageBackground>
          ) : null}
        </View>
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
      paddingBottom: 2,
    },
    pickerOptionsScroll: {
      maxHeight: 410,
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
    backgroundThumbnail: {
      borderRadius: 9,
      height: 40,
      width: 40,
    },
    previewButton: {
      alignItems: 'center',
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    backgroundPreviewBackdrop: {
      backgroundColor: '#090D16',
      flex: 1,
    },
    backgroundPreviewImage: {
      flex: 1,
    },
    backgroundPreviewOverlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(9, 13, 22, 0.38)',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
    },
    backgroundPreviewTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
    },
    pressed: {
      opacity: 0.68,
    },
  });
