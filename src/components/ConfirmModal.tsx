import { MaterialIcons } from '@expo/vector-icons';
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
  onOptionChange,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="delete-outline" size={24} color={colors.danger} />
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
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>{optionLabel}</Text>
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
                color={optionChecked ? colors.danger : colors.textMuted}
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
              style={({ pressed }) => [styles.button, styles.confirmButton, pressed && styles.pressed]}
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
    backgroundColor: colors.dangerSoft,
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
    backgroundColor: colors.dangerSoft,
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
    color: colors.danger,
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
  confirmButton: {
    backgroundColor: colors.danger,
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
