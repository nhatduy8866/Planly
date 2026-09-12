import { memo, useEffect, useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Easing,
  ImageBackground,
  type ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
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
  onViewTask: () => void;
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
  onViewTask,
}: AlarmRingingModalProps) {
  const insets = useSafeAreaInsets();
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

  // Hiệu ứng chuông lắc rung rinh khi đang reo
  const bellSwing = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      bellSwing.setValue(0);
      pulseScale.setValue(1);
      return;
    }

    const bellAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bellSwing, {
          duration: 100,
          easing: Easing.linear,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(bellSwing, {
          duration: 200,
          easing: Easing.linear,
          toValue: -1,
          useNativeDriver: true,
        }),
        Animated.timing(bellSwing, {
          duration: 100,
          easing: Easing.linear,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ]),
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          duration: 800,
          easing: Easing.out(Easing.ease),
          toValue: 1.06,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          duration: 800,
          easing: Easing.in(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    bellAnimation.start();
    pulseAnimation.start();

    return () => {
      bellAnimation.stop();
      pulseAnimation.stop();
    };
  }, [bellSwing, pulseScale, visible]);

  if (!visible) return null;

  const bellRotation = bellSwing.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-20deg', '20deg'],
  });

  const cardAccent = task?.color || colors.primary;
  const priority = task?.priority ?? 'none';
  const isLightBackground = backgroundAppearance === 'light';
  const primaryContentColor = isLightBackground ? '#172033' : '#FFFFFF';
  const alarmAccent = isLightBackground ? '#8A5A00' : '#FBBF24';

  const priorityConfigs: Record<
    TaskPriority,
    {
      label: string;
      color: string;
      bgColor: string;
      icon?: keyof typeof MaterialIcons.glyphMap;
    }
  > = {
    high: {
      bgColor: 'rgba(239, 68, 68, 0.16)',
      color: colors.priorityHigh || '#EF4444',
      icon: 'error',
      label: t('taskForm.priorityHigh'),
    },
    medium: {
      bgColor: 'rgba(245, 158, 11, 0.16)',
      color: colors.priorityMedium || '#F59E0B',
      icon: 'drag-handle',
      label: t('taskForm.priorityMedium'),
    },
    low: {
      bgColor: 'rgba(59, 130, 246, 0.16)',
      color: colors.priorityLow || '#3B82F6',
      icon: 'arrow-downward',
      label: t('taskForm.priorityLow'),
    },
    none: {
      bgColor: 'rgba(156, 163, 175, 0.12)',
      color: colors.textMuted || '#9CA3AF',
      label: t('taskForm.priorityNone'),
    },
  };

  const currentPriority = priorityConfigs[priority];

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
        {/* Header Huy hiệu BÁO THỨC */}
        <View style={styles.topBar}>
          <Animated.View
            style={[
              styles.ringingBadge,
              isLightBackground && styles.lightRingingBadge,
              { borderColor: alarmAccent },
              { transform: [{ scale: pulseScale }] },
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: bellRotation }] }}>
              <MaterialIcons name="alarm" size={20} color={alarmAccent} />
            </Animated.View>
            <Text style={[styles.ringingBadgeText, { color: alarmAccent }]}>
              {t('alarmModal.badge')}
            </Text>
          </Animated.View>
        </View>

        {/* Đồng hồ lớn */}
        <View style={styles.clockSection}>
          <Text style={[styles.clockText, { color: primaryContentColor }]}>
            {currentTime}
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
              {/* Hàng Giờ thực hiện & Badge Ưu tiên */}
              <View style={styles.taskMetaRow}>
                <View
                  style={[
                    styles.timeTag,
                    isLightBackground && styles.lightTimeTag,
                  ]}
                >
                  <MaterialIcons name="schedule" size={16} color={cardAccent} />
                  <Text style={[styles.timeTagText, { color: cardAccent }]}>
                    {t('alarmModal.startTime', {
                      time: task?.startTime ?? currentTime,
                    })}
                  </Text>
                </View>

                {priority !== 'none' ? (
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor: currentPriority.bgColor,
                        borderColor: currentPriority.color,
                      },
                    ]}
                  >
                    {currentPriority.icon ? (
                      <MaterialIcons
                        name={currentPriority.icon}
                        size={14}
                        color={currentPriority.color}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.priorityBadgeText,
                        { color: currentPriority.color },
                      ]}
                    >
                      {currentPriority.label}
                    </Text>
                  </View>
                ) : null}
              </View>

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

        {/* Cụm nút hành động dưới đáy */}
        <View style={styles.actionsSection}>
          {/* Nút Xem công việc */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('alarmModal.viewTask')}
            onPress={onViewTask}
            style={({ pressed }) => [
              styles.secondaryButton,
              isLightBackground && styles.lightSecondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <MaterialIcons
              name="event-note"
              size={22}
              color={primaryContentColor}
            />
            <Text
              style={[
                styles.secondaryButtonText,
                { color: primaryContentColor },
              ]}
            >
              {t('alarmModal.viewTask')}
            </Text>
          </Pressable>

          {/* Nút Tắt báo thức */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('alarmModal.dismiss')}
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <MaterialIcons name="alarm-off" size={24} color="#FFFFFF" />
            <Text style={styles.dismissButtonText}>
              {t('alarmModal.dismiss')}
            </Text>
          </Pressable>
        </View>
        </View>
      </ImageBackground>
    </Modal>
  );
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: '#090D16',
      flex: 1,
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: 24,
    },
    darkBackgroundOverlay: {
      backgroundColor: 'rgba(9, 13, 22, 0.68)',
    },
    lightBackgroundOverlay: {
      backgroundColor: 'rgba(255, 252, 247, 0.38)',
    },
    topBar: {
      alignItems: 'center',
      marginTop: 8,
    },
    ringingBadge: {
      alignItems: 'center',
      backgroundColor: 'rgba(251, 191, 36, 0.18)',
      borderColor: '#FBBF24',
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    ringingBadgeText: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    lightRingingBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.52)',
    },
    clockSection: {
      alignItems: 'center',
      marginVertical: 16,
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
      flex: 1,
      justifyContent: 'center',
      marginVertical: 8,
    },
    taskCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.07)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 24,
      borderWidth: 2,
      maxHeight: 340,
      overflow: 'hidden',
      position: 'relative',
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
      padding: 24,
      paddingTop: 26,
    },
    taskMetaRow: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    timeTag: {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 8,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    lightTimeTag: {
      backgroundColor: 'rgba(255, 255, 255, 0.62)',
    },
    timeTagText: {
      fontSize: 13,
      fontWeight: '700',
    },
    priorityBadge: {
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    priorityBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    taskTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 32,
      marginBottom: 12,
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
      gap: 14,
      marginTop: 16,
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      paddingVertical: 15,
    },
    lightSecondaryButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.68)',
      borderColor: 'rgba(23, 32, 51, 0.14)',
    },
    secondaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    dismissButton: {
      alignItems: 'center',
      backgroundColor: colors.danger || '#EF4444',
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      paddingVertical: 16,
      ...Platform.select({
        android: { elevation: 4 },
        ios: {
          shadowColor: '#EF4444',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        },
      }),
    },
    dismissButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    buttonPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.985 }],
    },
  });
