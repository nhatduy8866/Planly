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

import type { Translate } from '../i18n/translations';
import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { MOTION } from '../theme/motion';
import { useThemedStyles } from '../theme/useThemedStyles';
import { MotionModal } from './animation/MotionModal';
import { IconButton } from './IconButton';

export const CURRENT_PRIVACY_POLICY_VERSION = 1;

type TranslationKey = Parameters<Translate>[0];

interface PolicySection {
  bodyKey: TranslationKey;
  titleKey: TranslationKey;
}

interface PrivacyPolicyModalProps {
  onAccept?: () => void;
  onClose?: () => void;
  required?: boolean;
  visible: boolean;
}

const POLICY_SECTIONS: PolicySection[] = [
  {
    bodyKey: 'privacy.scopeBody',
    titleKey: 'privacy.scopeTitle',
  },
  {
    bodyKey: 'privacy.dataBody',
    titleKey: 'privacy.dataTitle',
  },
  {
    bodyKey: 'privacy.purposeBody',
    titleKey: 'privacy.purposeTitle',
  },
  {
    bodyKey: 'privacy.thirdPartyBody',
    titleKey: 'privacy.thirdPartyTitle',
  },
  {
    bodyKey: 'privacy.retentionBody',
    titleKey: 'privacy.retentionTitle',
  },
  {
    bodyKey: 'privacy.securityBody',
    titleKey: 'privacy.securityTitle',
  },
  {
    bodyKey: 'privacy.rightsBody',
    titleKey: 'privacy.rightsTitle',
  },
  {
    bodyKey: 'privacy.changesBody',
    titleKey: 'privacy.changesTitle',
  },
];

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
            <View style={styles.policyList} testID="privacy-policy-list">
              {POLICY_SECTIONS.map((section, index) => (
                <View
                  key={section.titleKey}
                  style={[
                    styles.policyItem,
                    index < POLICY_SECTIONS.length - 1 && styles.policyItemDivider,
                  ]}
                >
                  <Text style={styles.policyNumber}>{`${index + 1}.`}</Text>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
                    <Text style={styles.sectionBody}>{t(section.bodyKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
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
    policyItem: { flexDirection: 'row', gap: 10, padding: 14 },
    policyItemDivider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
    policyList: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 15,
      borderWidth: 1,
      overflow: 'hidden',
    },
    policyNumber: {
      color: colors.primaryDark,
      fontSize: 14,
      fontWeight: '900',
      lineHeight: 20,
      minWidth: 22,
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
    sectionBody: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
    sectionCopy: { flex: 1 },
    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    title: { color: colors.text, fontSize: 18, fontWeight: '800' },
    updated: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  });
