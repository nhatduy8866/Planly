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
  onDuplicate: () => void;
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
  onDuplicate,
  onDelete,
  compact = false,
}: TaskCardProps) {
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const cardAccent = colors[CARD_ACCENT_KEYS[getStableAccentIndex(task.id)]];
  const priorityColors: Record<Exclude<TaskPriority, 'none'>, string> = {
    high: colors.priorityHigh,
    medium: colors.priorityMedium,
    low: colors.priorityLow,
  };
  const priority = task.priority ?? 'none';
  const priorityVisual = priority === 'high'
    ? {
        backgroundColor: colors.priorityHighSoft,
        color: priorityColors.high,
        icon: 'priority-high' as const,
        label: t('taskForm.priorityHigh'),
      }
    : priority === 'medium'
      ? {
          backgroundColor: colors.priorityMediumSoft,
          color: priorityColors.medium,
          icon: 'flag' as const,
          label: t('taskForm.priorityMedium'),
        }
      : priority === 'low'
        ? {
            backgroundColor: colors.priorityLowSoft,
            color: priorityColors.low,
            icon: 'low-priority' as const,
            label: t('taskForm.priorityLow'),
          }
        : {
            backgroundColor: colors.surfaceMuted,
            color: colors.textMuted,
            icon: 'outlined-flag' as const,
            label: t('taskForm.priorityNone'),
          };

  return (
    <View
      style={[
        styles.card,
        { borderColor: cardAccent, borderLeftColor: cardAccent },
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
        <View
          accessible
          accessibilityLabel={`${t('taskForm.priority')}: ${priorityVisual.label}`}
          style={[
            styles.priorityIcon,
            { backgroundColor: priorityVisual.backgroundColor },
          ]}
        >
          <MaterialIcons
            name={priorityVisual.icon}
            size={17}
            color={task.completed ? colors.textMuted : priorityVisual.color}
          />
        </View>
        <View style={styles.secondaryActions}>
          <IconButton
            icon="content-copy"
            accessibilityLabel={t('task.duplicate')}
            onPress={onDuplicate}
            size={17}
            style={styles.smallButton}
          />
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
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 12,
  },
  cardCompleted: { backgroundColor: colors.surfaceMuted },
  checkButton: { paddingRight: 10, paddingTop: 2 },
  content: { flex: 1 },
  timeRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  time: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12 },
  completedMeta: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  completedText: { color: colors.textMuted, textDecorationLine: 'line-through' },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  actions: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 6 },
  priorityIcon: {
    alignItems: 'center',
    borderRadius: 9,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  secondaryActions: { flexDirection: 'row', gap: 4, marginTop: 6 },
  smallButton: { borderRadius: 9, height: 30, width: 30 },
});
