import { memo, useEffect, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import {
  ImageBackground,
  type ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../preferences/PreferencesContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { AlarmBackgroundAppearance, TaskPriority } from '../types';

export interface AlarmModalTaskData {
  id: string;
  title: string;
  startTime: string;
  description?: string;
  priority?: TaskPriority;
  color?: string;
}

interface AlarmRingingModalProps {
  backgroundAppearance?: AlarmBackgroundAppearance;
  backgroundColor?: string;
  backgroundSource?: ImageSourcePropType;
  soundSource?: number | string;
  vibrate?: boolean;
  visible: boolean;
  task?: AlarmModalTaskData | null;
  onDismiss: () => void;
}

function formatCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;
}

function formatCurrentDate(locale: string): string {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'full',
    }).format(now);
  } catch {
    return now.toDateString();
  }
}

export const AlarmRingingModal = memo(function AlarmRingingModal({
  backgroundAppearance = 'dark',
  backgroundColor,
  backgroundSource,
  soundSource,
  vibrate = true,
  visible,
  task,
  onDismiss,
}: AlarmRingingModalProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const alarmPlayer = useAudioPlayer(soundSource ?? null, {
    keepAudioSessionActive: true,
  });

  const [currentTime, setCurrentTime] = useState(formatCurrentTime);
  const [currentDate, setCurrentDate] = useState(() => formatCurrentDate(locale));

  useEffect(() => {
    if (!visible) {
      alarmPlayer.pause();
      Vibration.cancel();
      return;
    }

    let active = true;
    alarmPlayer.loop = true;
    alarmPlayer.volume = 1;
    void setAudioModeAsync({
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    })
      .then(() => {
        if (active) alarmPlayer.play();
      })
      .catch(() => {
        // The alarm screen remains actionable if media playback is unavailable.
      });

    if (vibrate) Vibration.vibrate([0, 700, 500], true);
    const timeout = setTimeout(() => {
      alarmPlayer.pause();
      Vibration.cancel();
    }, 5 * 60 * 1_000);

    return () => {
      active = false;
      clearTimeout(timeout);
      alarmPlayer.pause();
      Vibration.cancel();
    };
  }, [alarmPlayer, vibrate, visible]);

  // Cập nhật đồng hồ theo thời gian thực
  useEffect(() => {
    if (!visible) return;
    setCurrentTime(formatCurrentTime());
    setCurrentDate(formatCurrentDate(locale));

    const timer = setInterval(() => {
      setCurrentTime(formatCurrentTime());
    }, 1_000);

    return () => clearInterval(timer);
  }, [locale, visible]);

  if (!visible) return null;

  const alarmTime = task?.startTime || currentTime;
  const cardAccent = task?.color || colors.primary;
  const confirmButtonSize = Math.min(windowWidth / 2, 216);
  const priority = task?.priority ?? 'none';
  const isLightBackground = backgroundAppearance === 'light';
  const primaryContentColor = isLightBackground ? '#172033' : '#FFFFFF';

  const priorityColors: Record<TaskPriority, string> = {
    high: colors.priorityHigh || '#EF4444',
    medium: colors.priorityMedium || '#F59E0B',
    low: colors.priorityLow || '#3B82F6',
    none: colors.textMuted || '#9CA3AF',
  };
  const confirmButtonColor = priorityColors[priority];

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <StatusBar style={isLightBackground ? 'dark' : 'light'} />
      <ImageBackground
        resizeMode="cover"
        source={backgroundSource}
        style={[
          styles.container,
          backgroundColor ? { backgroundColor } : undefined,
        ]}
      >
        <View
          style={[
            styles.contentContainer,
            backgroundSource
              ? isLightBackground
                ? styles.lightBackgroundOverlay
                : styles.darkBackgroundOverlay
              : undefined,
            {
              paddingBottom: Math.max(insets.bottom, 24),
              paddingTop: Math.max(insets.top, 32),
            },
          ]}
        >
        {/* Đồng hồ lớn */}
        <View style={styles.clockSection}>
          <Text style={[styles.clockText, { color: primaryContentColor }]}>
            {alarmTime}
          </Text>
          <Text
            style={[
              styles.dateText,
              isLightBackground && styles.lightDateText,
            ]}
          >
            {currentDate}
          </Text>
        </View>

        {/* Thẻ Task Card chi tiết */}
        <View style={styles.cardContainer}>
          <View
            style={[
              styles.taskCard,
              isLightBackground && styles.lightTaskCard,
              {
                borderColor: cardAccent,
                borderLeftColor: cardAccent,
              },
            ]}
          >
            <View style={[styles.cardAccentBar, { backgroundColor: cardAccent }]} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.cardScrollContent}
            >
              {/* Tiêu đề Task */}
              <Text
                style={[
                  styles.taskTitle,
                  isLightBackground && styles.lightTaskTitle,
                ]}
              >
                {task?.title || t('settings.reminderTypeAlarm')}
              </Text>

              {/* Mô tả Task */}
              {task?.description ? (
                <View
                  style={[
                    styles.descriptionBox,
                    isLightBackground && styles.lightDescriptionBox,
                  ]}
                >
                  <Text
                    style={[
                      styles.descriptionText,
                      isLightBackground && styles.lightDescriptionText,
                    ]}
                  >
                    {task.description}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>

        {/* Nút xác nhận */}
        <View style={styles.actionsSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('alarmModal.confirm')}
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.confirmButton,
              {
                backgroundColor: confirmButtonColor,
                height: confirmButtonSize,
                shadowColor: confirmButtonColor,
                width: confirmButtonSize,
              },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.confirmButtonText}>
              {t('alarmModal.confirm')}
            </Text>
          </Pressable>
        </View>
        </View>
      </ImageBackground>
    </Modal>
  );
});

const createStyles = () =>
  StyleSheet.create({
    container: {
      backgroundColor: '#090D16',
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'space-evenly',
      paddingHorizontal: 24,
    },
    darkBackgroundOverlay: {
      backgroundColor: 'rgba(9, 13, 22, 0.68)',
    },
    lightBackgroundOverlay: {
      backgroundColor: 'rgba(255, 252, 247, 0.38)',
    },
    clockSection: {
      alignItems: 'center',
    },
    clockText: {
      color: '#FFFFFF',
      fontSize: 64,
      fontWeight: '200',
      letterSpacing: 2,
    },
    dateText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 15,
      fontWeight: '500',
      marginTop: 4,
      textTransform: 'capitalize',
    },
    lightDateText: {
      color: 'rgba(23, 32, 51, 0.72)',
    },
    cardContainer: {
      alignItems: 'center',
      flexShrink: 1,
      justifyContent: 'center',
      width: '100%',
    },
    taskCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 24,
      borderWidth: 2,
      maxHeight: 300,
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
    },
    lightTaskCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.68)',
    },
    cardAccentBar: {
      height: 4,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    cardScrollContent: {
      justifyContent: 'flex-start',
      padding: 24,
      paddingTop: 26,
    },
    taskTitle: {
      alignSelf: 'stretch',
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 32,
      marginBottom: 12,
      textAlign: 'center',
    },
    lightTaskTitle: {
      color: '#172033',
    },
    descriptionBox: {
      backgroundColor: 'rgba(0, 0, 0, 0.28)',
      borderRadius: 14,
      padding: 14,
    },
    lightDescriptionBox: {
      backgroundColor: 'rgba(23, 32, 51, 0.07)',
    },
    descriptionText: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 14,
      lineHeight: 22,
    },
    lightDescriptionText: {
      color: 'rgba(23, 32, 51, 0.82)',
    },
    actionsSection: {
      alignItems: 'center',
      width: '100%',
    },
    confirmButton: {
      alignItems: 'center',
      borderRadius: 999,
      justifyContent: 'center',
      ...Platform.select({
        android: { elevation: 4 },
        ios: {
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        },
      }),
    },
    confirmButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    buttonPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.985 }],
    },
  });
