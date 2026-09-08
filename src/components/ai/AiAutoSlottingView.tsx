import { MaterialIcons } from '@expo/vector-icons';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePreferences } from '../../preferences/PreferencesContext';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AiDraftTask } from '../../types/ai';
import { formatDuration } from '../../utils/date';

interface AiAutoSlottingViewProps {
  drafts: AiDraftTask[];
  infoMessage?: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onBack: () => void;
}

export function AiAutoSlottingView({
  drafts,
  infoMessage = null,
  onAccept,
  onDecline,
  onBack,
}: AiAutoSlottingViewProps) {
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const hasSlottingFailure = drafts.some(
    (draft) => draft.slottingStatus === 'unscheduled',
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.logoRow}>
          <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
          <Text style={styles.headerTitle}>{t('ai.planly')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {hasSlottingFailure
            ? t('ai.autoSlotFailure')
            : t('ai.autoSlotQuestion')}
        </Text>

        {infoMessage ? (
          <View style={styles.warningBox}>
            <MaterialIcons name="warning-amber" size={20} color={colors.warning} />
            <Text style={styles.warningText}>{infoMessage}</Text>
          </View>
        ) : null}

        <View style={styles.listContainer}>
          {drafts.map((task) => {
            const isUnscheduled = task.slottingStatus === 'unscheduled';
            return (
              <View key={task.id} style={styles.itemRow}>
                <MaterialIcons
                  name={isUnscheduled ? 'error-outline' : 'check-circle'}
                  size={22}
                  color={isUnscheduled ? colors.warning : colors.primary}
                />
                <Text style={styles.itemTitle}>
                  {task.title}{' '}
                  <Text style={styles.itemDuration}>
                    ({formatDuration(task.durationMinutes, locale)})
                  </Text>
                  {isUnscheduled ? (
                    <Text style={styles.unscheduledText}> · {t('ai.unscheduled')}</Text>
                  ) : null}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        {hasSlottingFailure ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <View style={styles.btnContent}>
              <View style={styles.btnRow}>
                <MaterialIcons name="edit" size={18} color={colors.white} />
                <Text style={styles.primaryBtnTitle}>{t('ai.editRequest')}</Text>
              </View>
              <Text style={styles.primaryBtnSubtitle}>
                {t('ai.editRequestSubtitle')}
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <View style={styles.btnContent}>
                <View style={styles.btnRow}>
                  <MaterialIcons name="auto-awesome" size={18} color={colors.white} />
                  <Text style={styles.primaryBtnTitle}>{t('ai.autoArrange')}</Text>
                </View>
                <Text style={styles.primaryBtnSubtitle}>
                  {t('ai.autoArrangeSubtitle')}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onDecline}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <View style={styles.btnContent}>
                <Text style={styles.secondaryBtnTitle}>{t('ai.chooseTime')}</Text>
                <Text style={styles.secondaryBtnSubtitle}>
                  {t('ai.chooseTimeSubtitle')}
                </Text>
              </View>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 20,
  },
  warningBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: -4,
    padding: 12,
  },
  warningText: {
    color: colors.warning,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  listContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  itemRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  itemTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  itemDuration: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  unscheduledText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
  },
  btnContent: {
    alignItems: 'center',
  },
  btnRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  primaryBtnTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryBtnSubtitle: {
    color: colors.white,
    fontSize: 12,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
  },
  secondaryBtnTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  secondaryBtnSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
  },
});
