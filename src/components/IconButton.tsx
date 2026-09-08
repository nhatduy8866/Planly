import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

interface IconButtonProps {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  color?: string;
  backgroundColor?: string;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color,
  backgroundColor,
  disabled = false,
  size = 20,
  style,
}: IconButtonProps) {
  const { colors } = usePreferences();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: backgroundColor ?? colors.surfaceMuted },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <MaterialIcons name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

const createStyles = (_colors: ThemeColors) => StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.65 },
});
