import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  optionChecked?: boolean;
  optionDescription?: string;
  optionLabel?: string;
  icon?: ComponentProps<typeof MaterialIcons>['name'];
  tone?: 'danger' | 'primary';
  onOptionChange?: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  optionChecked = false,
  optionDescription,
  optionLabel,
  tone = 'danger',
  icon,
  onOptionChange,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const accentColor = tone === 'danger' ? colors.danger : colors.primary;
  const accentSoftColor =
    tone === 'danger' ? colors.dangerSoft : colors.primarySoft;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: accentSoftColor },
            ]}
          >
            <MaterialIcons
              name={icon ?? (tone === 'danger' ? 'delete-outline' : 'repeat')}
              size={24}
              color={accentColor}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {optionLabel && onOptionChange ? (
            <Pressable
              accessibilityLabel={optionLabel}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: optionChecked }}
              onPress={() => onOptionChange(!optionChecked)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: accentSoftColor },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.optionCopy}>
                <Text style={[styles.optionLabel, { color: accentColor }]}>
                  {optionLabel}
                </Text>
                {optionDescription ? (
                  <Text style={styles.optionDescription}>
                    {optionDescription}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons
                name={
                  optionChecked ? 'check-box' : 'check-box-outline-blank'
                }
                size={24}
                color={optionChecked ? accentColor : colors.textMuted}
              />
            </Pressable>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel={cancelText ?? t('common.cancel')}
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>{cancelText ?? t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={confirmText ?? t('common.delete')}
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: accentColor },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmText}>{confirmText ?? t('common.delete')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 380,
    padding: 24,
    width: '100%',
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginBottom: 14,
    width: 48,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  option: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    padding: 12,
    width: '100%',
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  optionDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: colors.surfaceMuted,
  },
  cancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
