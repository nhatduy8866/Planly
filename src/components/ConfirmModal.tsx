import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Xóa',
  cancelText = 'Hủy',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
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
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.button, styles.confirmButton, pressed && styles.pressed]}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(23, 32, 25, 0.45)',
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
