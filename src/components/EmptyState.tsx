import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { MOTION, MOTION_EASING } from '../theme/motion';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useReducedMotion } from './animation/MotionProvider';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  primaryActionLabel?: string;
  primaryActionIcon?: IconName;
  onPrimaryAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  primaryActionLabel,
  primaryActionIcon,
  onPrimaryAction,
}: EmptyStateProps) {
  const { colors } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [entryAnim] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      entryAnim.setValue(1);
      return;
    }

    entryAnim.setValue(0);
    const anim = Animated.timing(entryAnim, {
      toValue: 1,
      duration: MOTION.duration.standard,
      easing: MOTION_EASING,
      useNativeDriver: true,
    });
    anim.start();

    return () => {
      anim.stop();
    };
  }, [entryAnim, icon, reducedMotion, title]);

  const containerTranslateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [MOTION.entrance.offsetY, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: entryAnim,
          transform: [{ translateY: containerTranslateY }],
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <MaterialIcons name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {primaryActionLabel && onPrimaryAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPrimaryAction}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.pressed,
          ]}
        >
          {primaryActionIcon ? (
            <MaterialIcons name={primaryActionIcon} size={18} color={colors.white} />
          ) : null}
          <Text style={styles.primaryActionText}>{primaryActionLabel}</Text>
        </Pressable>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            primaryActionLabel && styles.secondaryAction,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.actionText,
              primaryActionLabel && styles.secondaryActionText,
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingHorizontal: 36,
      paddingVertical: 34,
    },
    iconWrap: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 26,
      height: 76,
      justifyContent: 'center',
      marginBottom: 16,
      width: 76,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      elevation: 3,
    },
    title: { color: colors.text, fontSize: 17, fontWeight: '700' },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 6,
      textAlign: 'center',
    },
    action: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      marginTop: 18,
      paddingHorizontal: 18,
      paddingVertical: 11,
    },
    actionText: { color: colors.white, fontSize: 14, fontWeight: '700' },
    primaryAction: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 18,
      paddingHorizontal: 22,
      paddingVertical: 12,
      width: '100%',
      maxWidth: 240,
    },
    primaryActionText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
    secondaryAction: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      borderRadius: 14,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: 10,
      paddingHorizontal: 22,
      paddingVertical: 12,
      width: '100%',
      maxWidth: 240,
    },
    secondaryActionText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    pressed: {
      opacity: MOTION.pressedOpacity,
    },
  });
