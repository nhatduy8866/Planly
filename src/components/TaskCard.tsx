import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { Task, TaskPriority } from '../types';
import { formatDuration } from '../utils/date';
import { IconButton } from './IconButton';

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  compact?: boolean;
}

const PRIORITY_COLORS: Record<Exclude<TaskPriority, 'none'>, string> = {
  high: colors.priorityHigh,
  medium: colors.priorityMedium,
  low: colors.priorityLow,
};

export function TaskCard({
  task,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  compact = false,
}: TaskCardProps) {
  const priorityColor =
    task.priority && task.priority !== 'none'
      ? PRIORITY_COLORS[task.priority]
      : null;

  const priorityBorder =
    !task.completed && task.priority === 'high'
      ? styles.cardPriorityHigh
      : !task.completed && task.priority === 'medium'
        ? styles.cardPriorityMedium
        : !task.completed && task.priority === 'low'
          ? styles.cardPriorityLow
          : null;

  const timeColor = task.completed
    ? colors.textMuted
    : priorityColor ?? colors.primary;

  const bellColor = task.completed
    ? colors.textMuted
    : priorityColor ?? colors.warning;

  return (
    <View style={[styles.card, task.completed && styles.cardCompleted, priorityBorder]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed }}
        accessibilityLabel={`Đánh dấu ${task.title}`}
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
          <Text style={[styles.time, { color: timeColor }]}>{task.startTime}</Text>
          <Text style={styles.meta}>· {formatDuration(task.durationMinutes)}</Text>
          {task.reminderMinutes !== null ? (
            <MaterialIcons name="notifications" size={14} color={bellColor} />
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
        {onMoveUp && onMoveDown ? (
          <View style={styles.moveActions}>
            <IconButton
              icon="keyboard-arrow-up"
              accessibilityLabel="Đưa công việc lên"
              onPress={onMoveUp}
              disabled={disableMoveUp}
              size={19}
              style={styles.smallButton}
            />
            <IconButton
              icon="keyboard-arrow-down"
              accessibilityLabel="Đưa công việc xuống"
              onPress={onMoveDown}
              disabled={disableMoveDown}
              size={19}
              style={styles.smallButton}
            />
          </View>
        ) : null}
        <View style={styles.secondaryActions}>
          <IconButton
            icon="content-copy"
            accessibilityLabel="Nhân bản công việc"
            onPress={onDuplicate}
            size={17}
            style={styles.smallButton}
          />
          <IconButton
            icon="delete-outline"
            accessibilityLabel="Xóa công việc"
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 12,
  },
  cardCompleted: { backgroundColor: '#FAFBF9' },
  checkButton: { paddingRight: 10, paddingTop: 2 },
  content: { flex: 1 },
  timeRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  time: { fontSize: 13, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  completedText: { color: colors.textMuted, textDecorationLine: 'line-through' },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  actions: { justifyContent: 'space-between', marginLeft: 6 },
  moveActions: { flexDirection: 'row', gap: 4 },
  secondaryActions: { flexDirection: 'row', gap: 4, marginTop: 6 },
  smallButton: { borderRadius: 9, height: 30, width: 30 },
  cardPriorityHigh: {
    borderLeftColor: colors.priorityHigh,
    borderLeftWidth: 4.5,
  },
  cardPriorityMedium: {
    borderLeftColor: colors.priorityMedium,
    borderLeftWidth: 4.5,
  },
  cardPriorityLow: {
    borderLeftColor: colors.priorityLow,
    borderLeftWidth: 4.5,
  },
});
