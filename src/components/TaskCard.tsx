import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Task, TaskPriority } from '../types';
import { formatDuration } from '../utils/date';
import { IconButton } from './IconButton';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}

const CARD_ACCENT_KEYS = [
  'cardAccentLavender',
  'cardAccentBlue',
  'cardAccentMint',
  'cardAccentAmber',
  'cardAccentPink',
  'cardAccentPurple',
  'cardAccentPeach',
  'cardAccentLime',
  'cardAccentCyan',
  'cardAccentRose',
  'cardAccentYellow',
  'cardAccentSlate',
] as const satisfies readonly (keyof ThemeColors)[];

function getStableAccentIndex(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }

  return Math.abs(hash) % CARD_ACCENT_KEYS.length;
}

export function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  compact = false,
}: TaskCardProps) {
  const { colorfulAccents, colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const cardAccent = colorfulAccents
    ? colors[CARD_ACCENT_KEYS[getStableAccentIndex(task.id)]]
    : colors.border;
  const priority = task.priority ?? 'none';
  const priorityColors: Record<Exclude<TaskPriority, 'none'>, string> = {
    high: colors.priorityHigh,
    medium: colors.priorityMedium,
    low: colors.priorityLow,
  };

  return (
    <View style={styles.cardShadow}>
      <View
        style={[
          styles.card,
          colorfulAccents && { borderLeftWidth: 4, borderLeftColor: cardAccent },
          task.completed && styles.cardCompleted,
        ]}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
          accessibilityLabel={t('task.mark', { title: task.title })}
          onPress={onToggle}
          style={styles.checkButton}
        >
          <MaterialIcons
            name={task.completed ? 'check-circle' : 'radio-button-unchecked'}
            size={24}
            color={task.completed ? colors.primary : colors.textMuted}
          />
        </Pressable>

        <Pressable onPress={onEdit} style={styles.content}>
          <View style={styles.timeRow}>
            <Text style={[styles.time, task.completed && styles.completedMeta]}>
              {task.startTime}
            </Text>
            <Text style={styles.meta}>· {formatDuration(task.durationMinutes, locale)}</Text>
            {task.reminderMinutes !== null ? (
              <MaterialIcons
                name="notifications"
                size={14}
                color={task.completed ? colors.textMuted : colors.warning}
              />
            ) : null}
          </View>
          <Text
            numberOfLines={2}
            style={[styles.title, task.completed && styles.completedText]}
          >
            {task.title}
          </Text>
          {!compact && task.description ? (
            <Text numberOfLines={2} style={styles.description}>
              {task.description}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.actions}>
          <IconButton
            icon="delete-outline"
            accessibilityLabel={t('task.delete')}
            onPress={onDelete}
            color={colors.danger}
            backgroundColor={colors.dangerSoft}
            size={18}
            style={styles.smallButton}
          />
        </View>

        {priority !== 'none' ? (
          <View
            testID="task-card-priority-corner"
            pointerEvents="none"
            style={[styles.priorityCorner, { borderTopColor: priorityColors[priority] }]}
          />
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  cardShadow: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    elevation: 2,
    marginBottom: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 13,
    position: 'relative',
  },
  cardCompleted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.82,
  },
  priorityCorner: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 26,
    borderStyle: 'solid',
    borderTopWidth: 26,
    height: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 0,
    zIndex: 1,
  },
  checkButton: { paddingRight: 10, paddingTop: 1 },
  content: { flex: 1 },
  timeRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  time: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  completedMeta: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20, marginTop: 4 },
  completedText: { color: colors.textMuted, textDecorationLine: 'line-through' },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  actions: { alignItems: 'flex-end', justifyContent: 'flex-end', marginLeft: 8 },
  smallButton: { borderRadius: 9, height: 30, width: 30 },
});
