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
import type { ScheduleConflict } from '../../types/ai';

interface AiConflictViewProps {
  conflicts: ScheduleConflict[];
  onSelectSlot: (conflictIndex: number, slotId: string) => void;
  onApply: () => void;
  onBack: () => void;
}

export function AiConflictView({
  conflicts,
  onSelectSlot,
  onApply,
  onBack,
}: AiConflictViewProps) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const currentConflict = conflicts[0]; // Hiển thị conflict đầu tiên hoặc lần lượt

  if (!currentConflict) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('ai.conflictTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning Alert Box */}
        <View style={styles.alertBox}>
          <MaterialIcons name="warning" size={24} color={colors.priorityHigh} />
          <View style={styles.alertTextWrap}>
            <Text style={styles.alertTitle}>
              {t('ai.conflictCount', { count: conflicts.length })}
            </Text>
            <Text style={styles.alertDetails}>
              {t('ai.conflictAlert', {
                draft: currentConflict.draftTaskTitle,
                existing: currentConflict.conflictingTask.title,
              })}{' '}
              ({currentConflict.draftTime})
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('ai.alternativeTimes')}</Text>

        {/* Radio Slot Options */}
        <View style={styles.optionsList}>
          {currentConflict.suggestedSlots.map((slot) => {
            const isSelected = slot.id === currentConflict.selectedSlotId;

            return (
              <Pressable
                key={slot.id}
                onPress={() => onSelectSlot(0, slot.id)}
                style={({ pressed }) => [
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={22}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
                <View style={styles.optionContent}>
                  <View style={styles.timeTitleRow}>
                    <Text style={styles.optionTime}>{slot.startTime}</Text>
                    {slot.tag ? (
                      <View style={styles.suggestionTag}>
                        <Text style={styles.suggestionTagText}>{t('ai.suggestion')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.optionLabel}>
                    {slot.id === 'slot_after_conflict'
                      ? t('ai.afterConflict', {
                          title: currentConflict.conflictingTask.title,
                        })
                      : slot.id === 'slot_afternoon'
                        ? t('ai.afternoon')
                        : t('ai.nextAvailable')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={onApply}
          disabled={!currentConflict.suggestedSlots.length}
          style={({ pressed }) => [
            styles.submitButton,
            !currentConflict.suggestedSlots.length && styles.submitButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.submitText}>{t('ai.updateSchedule')}</Text>
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  alertBox: {
    backgroundColor: colors.priorityHighSoft,
    borderColor: colors.priorityHigh,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    padding: 16,
  },
  alertTextWrap: {
    flex: 1,
  },
  alertTitle: {
    color: colors.priorityHigh,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  alertDetails: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  optionCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionContent: {
    flex: 1,
  },
  timeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  optionTime: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  suggestionTag: {
    backgroundColor: colors.aiTag,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  suggestionTagText: {
    color: colors.aiTagText,
    fontSize: 11,
    fontWeight: '700',
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
