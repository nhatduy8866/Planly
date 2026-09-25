import { MaterialIcons } from '@expo/vector-icons';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { MOTION } from '../theme/motion';
import { useThemedStyles } from '../theme/useThemedStyles';
import { MotionModal } from './animation/MotionModal';
import { IconButton } from './IconButton';

export const CURRENT_PRIVACY_POLICY_VERSION = 1;

interface PrivacyPolicyModalProps {
  onAccept?: () => void;
  onClose?: () => void;
  required?: boolean;
  visible: boolean;
}

export function PrivacyPolicyModal({
  onAccept,
  onClose,
  required = false,
  visible,
}: PrivacyPolicyModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);

  function finish() {
    if (required) onAccept?.();
    else onClose?.();
  }

  return (
    <MotionModal
      onRequestClose={required ? () => undefined : () => onClose?.()}
      transparent={Platform.OS === 'web'}
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View
            style={[
              styles.header,
              { paddingTop: Platform.OS === 'web' ? 18 : insets.top + 12 },
            ]}
          >
            <View style={styles.headerIcon}>
              <MaterialIcons
                color={colors.primaryDark}
                name="privacy-tip"
                size={24}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t('privacy.title')}</Text>
              <Text style={styles.updated}>{t('privacy.updated')}</Text>
            </View>
            {!required ? (
              <IconButton
                accessibilityLabel={t('common.close')}
                backgroundColor={colors.surfaceMuted}
                icon="close"
                onPress={() => onClose?.()}
              />
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.policyText} testID="privacy-policy-content">
              {t('privacy.content')}
            </Text>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Platform.OS === 'web' ? 18 : Math.max(insets.bottom, 18) },
            ]}
          >
            {required ? (
              <Text style={styles.consent}>{t('privacy.consent')}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={finish}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {t(required ? 'privacy.accept' : 'privacy.close')}
              </Text>
              <MaterialIcons
                color={colors.white}
                name={required ? 'check' : 'close'}
                size={19}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </MotionModal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      alignItems: 'center',
      backgroundColor: Platform.OS === 'web' ? colors.overlay : colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: Platform.OS === 'web' ? 24 : 0,
      borderWidth: Platform.OS === 'web' ? 1 : 0,
      flex: Platform.OS === 'web' ? undefined : 1,
      maxHeight: Platform.OS === 'web' ? 720 : undefined,
      maxWidth: 480,
      overflow: 'hidden',
      width: Platform.OS === 'web' ? '92%' : '100%',
    },
    consent: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
    content: {
      gap: 12,
      padding: 18,
    },
    footer: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 14,
    },
    header: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 11,
      paddingBottom: 14,
      paddingHorizontal: 16,
    },
    headerCopy: { flex: 1 },
    headerIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    policyText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 22,
    },
    pressed: { opacity: MOTION.pressedOpacity },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: 18,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '800',
    },
    title: { color: colors.text, fontSize: 18, fontWeight: '800' },
    updated: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  });
