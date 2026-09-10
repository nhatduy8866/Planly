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
import { formatLongDate } from '../../utils/date';

interface AiDraftPreviewViewProps {
  isUpdated?: boolean; // True nếu là Screen 7 (Kế hoạch đã cập nhật)
  drafts: AiDraftTask[];
  targetDate: string;
  onConfirm: () => void;
  onRefine: () => void;
  onBack: () => void;
}

export function AiDraftPreviewView({
  isUpdated = false,
  drafts,
  targetDate,
  onConfirm,
  onRefine,
  onBack,
}: AiDraftPreviewViewProps) {
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const primaryDate = drafts[0]?.date || targetDate;
  const formattedDate = formatLongDate(primaryDate, locale);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t(isUpdated ? 'ai.updatedPreviewTitle' : 'ai.previewTitle')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subHeader}>
          {t('ai.previewSubtitle', { count: drafts.length, date: formattedDate })}
        </Text>

        {drafts.map((task, index) => {
          const taskTime = task.startTime || t('ai.noTime');

          // Tag nhãn
          let tagLabel = t('ai.fromRequestTag');
          let isUpdatedTag = false;

          if (isUpdated) {
            if (task.changeStatus === 'updated' || task.changeStatus === 'added') {
              tagLabel = t('ai.updatedTag');
              isUpdatedTag = true;
            } else {
              tagLabel = t('ai.unchangedTag');
            }
          }

          return (
            <View key={`${task.id || 'draft'}-${index}`} style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.timeWrap}>
                  <View
                    style={[
                      styles.dot,
                      task.priority === 'high'
                        ? styles.dotHigh
                        : task.priority === 'medium'
                          ? styles.dotMedium
                          : styles.dotNormal,
                    ]}
                  />
                  <Text style={styles.timeText}>{taskTime}</Text>
                </View>

                <View style={styles.tagWrap}>
                  <View
                    style={[
                      styles.badge,
                      isUpdatedTag ? styles.badgeUpdated : styles.badgeDefault,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        isUpdatedTag ? styles.badgeTextUpdated : styles.badgeTextDefault,
                      ]}
                    >
                      {tagLabel}
                    </Text>
                  </View>
                  <MaterialIcons name="more-vert" size={20} color={colors.textMuted} />
                </View>
              </View>

              <Text style={styles.taskTitle}>{task.title}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MaterialIcons name="event" size={14} color={colors.primary} />
                  <Text style={[styles.metaText, { color: colors.primary, fontWeight: '700' }]}>
                    {formatLongDate(task.date || primaryDate, locale).split(',')[0]}
                  </Text>
                </View>
                {task.reminderMinutes !== null ? (
                  <View style={styles.metaItem}>
                    <MaterialIcons name="notifications" size={14} color={colors.warning} />
                    <Text style={styles.metaText}>
                      {task.reminderMinutes === 0
                        ? t('task.reminderOnTime')
                        : t('ai.reminderBefore', { count: task.reminderMinutes })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="add" size={20} color={colors.white} />
          <Text style={styles.primaryButtonText}>{t('ai.addToCalendar')}</Text>
        </Pressable>

        <Pressable
          onPress={onRefine}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="refresh" size={18} color={colors.text} />
          <Text style={styles.secondaryButtonText}>
            {t(isUpdated ? 'ai.continueRefining' : 'ai.refinePlan')}
          </Text>
        </Pressable>
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
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  subHeader: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotHigh: {
    backgroundColor: colors.priorityHigh,
  },
  dotMedium: {
    backgroundColor: colors.priorityMedium,
  },
  dotNormal: {
    backgroundColor: colors.primary,
  },
  timeText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  tagWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeDefault: {
    backgroundColor: colors.aiTag,
  },
  badgeUpdated: {
    backgroundColor: colors.aiUpdatedTag,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextDefault: {
    color: colors.aiTagText,
  },
  badgeTextUpdated: {
    color: colors.aiUpdatedTagText,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12.5,
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
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
