import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AiSaveFeedback } from '../../hooks/useAiScheduler';
import { usePreferences } from '../../preferences/PreferencesContext';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { formatLongDate } from '../../utils/date';

interface AiSaveSnackbarProps {
  action: 'undo' | 'view';
  busy?: boolean;
  feedback: AiSaveFeedback | null;
  onAction: () => void;
  onDismiss: () => void;
}

export function AiSaveSnackbar({
  action,
  busy = false,
  feedback,
  onAction,
  onDismiss,
}: AiSaveSnackbarProps) {
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!feedback) return;
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      duration: 180,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, feedback]);

  const copy = useMemo(() => {
    if (!feedback) return null;
    let message: string;
    if (feedback.createdCount && feedback.updatedCount) {
      message = t('ai.feedbackSaved', { count: feedback.tasks.length });
    } else if (feedback.updatedCount === 1) {
      message = t('ai.feedbackUpdatedOne', {
        title: feedback.tasks[0]?.title ?? '',
      });
    } else if (feedback.updatedCount > 1) {
      message = t('ai.feedbackUpdatedMany', {
        count: feedback.updatedCount,
      });
    } else {
      message = t('ai.feedbackCreated', { count: feedback.createdCount });
    }

    const dates = Array.from(new Set(feedback.tasks.map((task) => task.date)));
    const detail = dates.length === 1
      ? [
          formatLongDate(dates[0], locale),
          ...Array.from(
            new Set(
              feedback.tasks
                .filter((task) => task.date === dates[0])
                .map((task) => task.startTime)
                .filter(Boolean),
            ),
          ).sort(),
        ].join(' · ')
      : t('ai.feedbackAcrossDates', { count: dates.length });

    return { detail, message };
  }, [feedback, locale, t]);

  if (!feedback || !copy) return null;

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          {
            opacity: entrance,
            transform: [{
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            }],
          },
        ]}
      >
        <View style={styles.iconWrap}>
          <MaterialIcons name="check" size={18} color={colors.white} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.message}>{copy.message}</Text>
          <Text numberOfLines={1} style={styles.detail}>{copy.detail}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryDark} size="small" />
          ) : (
            <Text style={styles.actionText}>
              {t(action === 'undo' ? 'ai.feedbackUndo' : 'ai.feedbackView')}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel={t('ai.feedbackDismiss')}
          accessibilityRole="button"
          onPress={onDismiss}
          hitSlop={8}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
        >
          <MaterialIcons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  action: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 68,
    paddingHorizontal: 12,
  },
  actionText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 10,
    maxWidth: 480,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    width: '100%',
  },
  copy: { flex: 1, minWidth: 0 },
  detail: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  disabled: { opacity: 0.65 },
  dismiss: { alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  layer: {
    alignItems: 'center',
    bottom: 16,
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 20,
  },
  message: { color: colors.text, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
