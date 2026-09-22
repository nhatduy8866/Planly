import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
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
import { IconButton } from './IconButton';
import { MotionModal } from './animation/MotionModal';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
type TranslationKey = Parameters<Translate>[0];

interface GuideSection {
  icon: IconName;
  id: string;
  stepKeys: TranslationKey[];
  tipKey: TranslationKey;
  titleKey: TranslationKey;
}

interface UserGuideModalProps {
  onClose: () => void;
  onReplayOnboarding: () => void;
  visible: boolean;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    icon: 'task-alt',
    id: 'getting-started',
    stepKeys: [
      'guide.gettingStarted.step1',
      'guide.gettingStarted.step2',
      'guide.gettingStarted.step3',
    ],
    tipKey: 'guide.gettingStarted.tip',
    titleKey: 'guide.gettingStarted.title',
  },
  {
    icon: 'calendar-month',
    id: 'calendar',
    stepKeys: [
      'guide.calendar.step1',
      'guide.calendar.step2',
      'guide.calendar.step3',
    ],
    tipKey: 'guide.calendar.tip',
    titleKey: 'guide.calendar.title',
  },
  {
    icon: 'auto-awesome',
    id: 'ai',
    stepKeys: ['guide.ai.step1', 'guide.ai.step2', 'guide.ai.step3'],
    tipKey: 'guide.ai.tip',
    titleKey: 'guide.ai.title',
  },
  {
    icon: 'event-repeat',
    id: 'repeat',
    stepKeys: [
      'guide.repeat.step1',
      'guide.repeat.step2',
      'guide.repeat.step3',
    ],
    tipKey: 'guide.repeat.tip',
    titleKey: 'guide.repeat.title',
  },
  {
    icon: 'notifications-active',
    id: 'reminders',
    stepKeys: [
      'guide.reminders.step1',
      'guide.reminders.step2',
      'guide.reminders.step3',
    ],
    tipKey: 'guide.reminders.tip',
    titleKey: 'guide.reminders.title',
  },
  {
    icon: 'cloud-sync',
    id: 'sync',
    stepKeys: ['guide.sync.step1', 'guide.sync.step2', 'guide.sync.step3'],
    tipKey: 'guide.sync.tip',
    titleKey: 'guide.sync.title',
  },
  {
    icon: 'palette',
    id: 'personalize',
    stepKeys: [
      'guide.personalize.step1',
      'guide.personalize.step2',
      'guide.personalize.step3',
    ],
    tipKey: 'guide.personalize.tip',
    titleKey: 'guide.personalize.title',
  },
];

export function UserGuideModal({
  onClose,
  onReplayOnboarding,
  visible,
}: UserGuideModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [expandedSection, setExpandedSection] = useState<string | undefined>(
    GUIDE_SECTIONS[0].id,
  );

  function toggleSection(sectionId: string) {
    setExpandedSection((current) =>
      current === sectionId ? undefined : sectionId,
    );
  }

  return (
    <MotionModal
      onRequestClose={onClose}
      transparent={Platform.OS === 'web'}
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View
            style={[
              styles.closeButton,
              { top: Platform.OS === 'web' ? 12 : Math.max(insets.top + 4, 16) },
            ]}
          >
            <IconButton
              accessibilityLabel={t('common.close')}
              backgroundColor={colors.surface}
              icon="close"
              onPress={onClose}
            />
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom: Math.max(insets.bottom + 36, 48),
                paddingTop:
                  Platform.OS === 'web' ? 72 : Math.max(insets.top + 68, 88),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <MaterialIcons
                  name="help-outline"
                  size={30}
                  color={colors.primaryDark}
                />
              </View>
              <Text style={styles.title}>{t('guide.title')}</Text>
              <Text style={styles.subtitle}>{t('guide.subtitle')}</Text>
            </View>

            <View style={styles.sections}>
              {GUIDE_SECTIONS.map((section) => {
                const expanded = expandedSection === section.id;
                return (
                  <View key={section.id} style={styles.sectionCard}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => toggleSection(section.id)}
                      style={({ pressed }) => [
                        styles.sectionHeader,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.sectionIcon}>
                        <MaterialIcons
                          name={section.icon}
                          size={22}
                          color={colors.primaryDark}
                        />
                      </View>
                      <Text style={styles.sectionTitle}>
                        {t(section.titleKey)}
                      </Text>
                      <MaterialIcons
                        name={expanded ? 'expand-less' : 'expand-more'}
                        size={24}
                        color={colors.textMuted}
                      />
                    </Pressable>

                    {expanded ? (
                      <View style={styles.sectionBody}>
                        {section.stepKeys.map((stepKey, index) => (
                          <View key={stepKey} style={styles.stepRow}>
                            <View style={styles.stepNumber}>
                              <Text style={styles.stepNumberText}>{index + 1}</Text>
                            </View>
                            <Text style={styles.stepText}>{t(stepKey)}</Text>
                          </View>
                        ))}
                        <View style={styles.tipCard}>
                          <MaterialIcons
                            name="tips-and-updates"
                            size={18}
                            color={colors.accent}
                          />
                          <View style={styles.tipCopy}>
                            <Text style={styles.tipLabel}>{t('guide.tip')}</Text>
                            <Text style={styles.tipText}>{t(section.tipKey)}</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <Pressable
              accessibilityLabel={t('guide.replayOnboarding')}
              accessibilityRole="button"
              onPress={() => {
                onReplayOnboarding();
              }}
              style={({ pressed }) => [
                styles.replayButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="replay" size={21} color={colors.primaryDark} />
              <View style={styles.replayCopy}>
                <Text style={styles.replayTitle}>
                  {t('guide.replayOnboarding')}
                </Text>
                <Text style={styles.replayDescription}>
                  {t('guide.replayOnboardingDescription')}
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={colors.textMuted}
              />
            </Pressable>
          </ScrollView>
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
      height: Platform.OS === 'web' ? '88%' : '100%',
      maxHeight: Platform.OS === 'web' ? 720 : undefined,
      maxWidth: 480,
      overflow: 'hidden',
      width: Platform.OS === 'web' ? '92%' : '100%',
    },
    closeButton: { left: 14, position: 'absolute', zIndex: 2 },
    content: { paddingHorizontal: 16 },
    hero: { alignItems: 'center', marginBottom: 24 },
    heroIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 20,
      height: 58,
      justifyContent: 'center',
      marginBottom: 14,
      width: 58,
    },
    pressed: { opacity: MOTION.pressedOpacity },
    replayButton: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 11,
      marginTop: 20,
      padding: 14,
    },
    replayCopy: { flex: 1 },
    replayDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    replayTitle: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
    sectionBody: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 12,
      padding: 14,
      paddingTop: 16,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
    },
    sectionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 11,
      minHeight: 64,
      paddingHorizontal: 13,
    },
    sectionIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 11,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    sectionTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
    },
    sections: { gap: 10 },
    stepNumber: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 11,
      height: 23,
      justifyContent: 'center',
      marginTop: 1,
      width: 23,
    },
    stepNumberText: {
      color: colors.primaryDark,
      fontSize: 11,
      fontWeight: '900',
    },
    stepRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
    stepText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      lineHeight: 20,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 7,
      maxWidth: 380,
      textAlign: 'center',
    },
    tipCard: {
      alignItems: 'flex-start',
      backgroundColor: colors.warningSoft,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 9,
      marginTop: 2,
      padding: 11,
    },
    tipCopy: { flex: 1 },
    tipLabel: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    tipText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 2,
    },
    title: { color: colors.text, fontSize: 25, fontWeight: '900' },
  });
