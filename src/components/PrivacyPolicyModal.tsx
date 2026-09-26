import { MaterialIcons } from '@expo/vector-icons';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { legalConfig } from '../config/legal';
import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { MOTION } from '../theme/motion';
import { useThemedStyles } from '../theme/useThemedStyles';
import { MotionModal } from './animation/MotionModal';
import { IconButton } from './IconButton';

export const CURRENT_PRIVACY_POLICY_VERSION = 3;

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
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID="privacy-policy-dialog">
          <View
            style={[
              styles.header,
              { paddingTop: 18 },
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
            style={styles.policyScroll}
          >
            {legalConfig.dataControllerName ? (
              <Text style={styles.legalDetail}>
                {t('privacy.controller', {
                  name: legalConfig.dataControllerName,
                })}
              </Text>
            ) : null}
            {legalConfig.privacyContactEmail ? (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    `mailto:${legalConfig.privacyContactEmail}`,
                  )
                }
              >
                <Text style={styles.link}>
                  {t('privacy.contact', {
                    email: legalConfig.privacyContactEmail,
                  })}
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.policyText} testID="privacy-policy-content">
              {t('privacy.content')}
            </Text>
            {legalConfig.privacyPolicyUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(legalConfig.privacyPolicyUrl!)
                }
              >
                <Text style={styles.link}>{t('privacy.openPublished')}</Text>
              </Pressable>
            ) : null}
            {legalConfig.accountDeletionUrl ? (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(legalConfig.accountDeletionUrl!)
                }
              >
                <Text style={styles.link}>{t('privacy.openDeletion')}</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 18) },
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
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 24,
    },
    card: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      maxHeight: '82%',
      maxWidth: 440,
      overflow: 'hidden',
      width: '100%',
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
    legalDetail: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    link: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    policyText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 22,
    },
    policyScroll: { flexShrink: 1 },
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
