import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  Platform,
  Pressable,
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

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type TranslationKey = Parameters<Translate>[0];

interface OnboardingPage {
  descriptionKey: TranslationKey;
  detailKey: TranslationKey;
  icon: IconName;
  titleKey: TranslationKey;
}

interface OnboardingModalProps {
  onFinish: () => void;
  visible: boolean;
}

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    descriptionKey: 'onboarding.planDescription',
    detailKey: 'onboarding.planDetail',
    icon: 'event-available',
    titleKey: 'onboarding.planTitle',
  },
  {
    descriptionKey: 'onboarding.reminderDescription',
    detailKey: 'onboarding.reminderDetail',
    icon: 'notifications-active',
    titleKey: 'onboarding.reminderTitle',
  },
  {
    descriptionKey: 'onboarding.personalDescription',
    detailKey: 'onboarding.personalDetail',
    icon: 'cloud-done',
    titleKey: 'onboarding.personalTitle',
  },
];

export function OnboardingModal({ onFinish, visible }: OnboardingModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, language, t, toggleLanguage } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [pageIndex, setPageIndex] = useState(0);
  const page = ONBOARDING_PAGES[pageIndex];
  const isLastPage = pageIndex === ONBOARDING_PAGES.length - 1;

  function finish() {
    setPageIndex(0);
    onFinish();
  }

  function next() {
    if (isLastPage) {
      finish();
      return;
    }
    setPageIndex((current) => current + 1);
  }

  return (
    <MotionModal
      onRequestClose={finish}
      transparent={Platform.OS === 'web'}
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              paddingBottom: Math.max(insets.bottom + 20, 28),
              paddingTop: Platform.OS === 'web' ? 24 : Math.max(insets.top + 12, 28),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={styles.brandIcon}>
                <MaterialIcons name="check" size={18} color={colors.white} />
              </View>
              <Text style={styles.brandText}>Planly</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel={t('onboarding.changeLanguage')}
                accessibilityRole="button"
                onPress={toggleLanguage}
                style={({ pressed }) => [
                  styles.languageButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="language"
                  size={16}
                  color={colors.primaryDark}
                />
                <Text style={styles.languageButtonText}>
                  {language === 'vi' ? 'EN' : 'VI'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t('onboarding.skip')}
                accessibilityRole="button"
                onPress={finish}
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.illustration}>
              <View style={styles.illustrationHalo} />
              <View style={styles.illustrationIcon}>
                <MaterialIcons
                  name={page.icon}
                  size={58}
                  color={colors.primaryDark}
                />
              </View>
              <View style={[styles.sparkle, styles.sparkleTop]}>
                <MaterialIcons name="auto-awesome" size={19} color={colors.accent} />
              </View>
              <View style={[styles.sparkle, styles.sparkleBottom]}>
                <MaterialIcons name="check" size={17} color={colors.primary} />
              </View>
            </View>

            <Text style={styles.progressText}>
              {t('onboarding.progress', {
                current: pageIndex + 1,
                total: ONBOARDING_PAGES.length,
              })}
            </Text>
            <Text style={styles.title}>{t(page.titleKey)}</Text>
            <Text style={styles.description}>{t(page.descriptionKey)}</Text>

            <View style={styles.detailCard}>
              <MaterialIcons
                name="tips-and-updates"
                size={20}
                color={colors.primaryDark}
              />
              <Text style={styles.detailText}>{t(page.detailKey)}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {ONBOARDING_PAGES.map((item, index) => (
                <View
                  key={item.titleKey}
                  style={[styles.dot, index === pageIndex && styles.dotActive]}
                />
              ))}
            </View>

            <View style={styles.actions}>
              {pageIndex > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setPageIndex((current) => current - 1);
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={19}
                    color={colors.text}
                  />
                  <Text style={styles.secondaryButtonText}>
                    {t('onboarding.back')}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.actionSpacer} />
              )}

              <Pressable
                accessibilityRole="button"
                onPress={next}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {t(isLastPage ? 'onboarding.start' : 'onboarding.next')}
                </Text>
                <MaterialIcons
                  name={isLastPage ? 'check' : 'arrow-forward'}
                  size={19}
                  color={colors.white}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </MotionModal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    actionSpacer: { flex: 1 },
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    backdrop: {
      alignItems: 'center',
      backgroundColor: Platform.OS === 'web' ? colors.overlay : colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    brand: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    brandIcon: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 9,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    brandText: { color: colors.text, fontSize: 19, fontWeight: '900' },
    card: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: Platform.OS === 'web' ? 24 : 0,
      borderWidth: Platform.OS === 'web' ? 1 : 0,
      flex: Platform.OS === 'web' ? undefined : 1,
      height: Platform.OS === 'web' ? 680 : '100%',
      maxHeight: Platform.OS === 'web' ? '92%' : undefined,
      maxWidth: 480,
      paddingHorizontal: 22,
      width: Platform.OS === 'web' ? '92%' : '100%',
    },
    content: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingBottom: 24,
    },
    description: {
      color: colors.textMuted,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 12,
      maxWidth: 380,
      textAlign: 'center',
    },
    detailCard: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      marginTop: 24,
      maxWidth: 380,
      paddingHorizontal: 14,
      paddingVertical: 12,
      width: '100%',
    },
    detailText: {
      color: colors.primaryDark,
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    dot: {
      backgroundColor: colors.border,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    dotActive: { backgroundColor: colors.primary, width: 22 },
    dots: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      marginBottom: 20,
    },
    footer: { marginTop: 'auto' },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    illustration: {
      alignItems: 'center',
      height: 190,
      justifyContent: 'center',
      marginBottom: 20,
      width: 210,
    },
    illustrationHalo: {
      backgroundColor: colors.primarySoft,
      borderRadius: 75,
      height: 150,
      position: 'absolute',
      width: 150,
    },
    illustrationIcon: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 28,
      borderWidth: 1,
      elevation: 3,
      height: 116,
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { height: 5, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      width: 116,
    },
    languageButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      minHeight: 34,
      paddingHorizontal: 9,
    },
    languageButtonText: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '900',
    },
    pressed: { opacity: MOTION.pressedOpacity },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      flex: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: 16,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '800',
    },
    progressText: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: 16,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    skipButton: { paddingHorizontal: 4, paddingVertical: 8 },
    skipText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
    sparkle: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 36,
      justifyContent: 'center',
      position: 'absolute',
      width: 36,
    },
    sparkleBottom: { bottom: 22, left: 28 },
    sparkleTop: { right: 22, top: 18 },
    title: {
      color: colors.text,
      fontSize: 27,
      fontWeight: '900',
      lineHeight: 34,
      marginTop: 8,
      maxWidth: 390,
      textAlign: 'center',
    },
  });
