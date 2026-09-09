import { memo, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Task, TaskPriority } from '../types';
import { IconButton } from './IconButton';

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  compact?: boolean;
  completionPending?: boolean;
  completionUndoSeconds?: number;
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

export const TaskCard = memo(function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  compact = false,
  completionPending = false,
  completionUndoSeconds,
}: TaskCardProps) {
  const { colorfulAccents, colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const cardAccent = colorfulAccents
    ? colors[CARD_ACCENT_KEYS[getStableAccentIndex(task.id)]]
    : colors.border;
  const isCompleted = task.completed || completionPending;
  const [completionProgress] = useState(
    () => new Animated.Value(isCompleted ? 1 : 0),
  );
  const [toggleScale] = useState(() => new Animated.Value(1));
  const [overlayProgress] = useState(
    () => new Animated.Value(completionPending ? 1 : 0),
  );
  const priority = task.priority ?? 'none';
  const priorityColors: Record<Exclude<TaskPriority, 'none'>, string> = {
    high: colors.priorityHigh,
    medium: colors.priorityMedium,
    low: colors.priorityLow,
  };

  const handleToggle = useCallback(() => {
    onToggle(task);
  }, [onToggle, task]);

  const handleEdit = useCallback(() => {
    onEdit(task);
  }, [onEdit, task]);

  const handleDelete = useCallback(() => {
    onDelete(task);
  }, [onDelete, task]);

  useEffect(() => {
    const animation = Animated.timing(completionProgress, {
      duration: 180,
      toValue: isCompleted ? 1 : 0,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [completionProgress, isCompleted]);

  useEffect(() => {
    toggleScale.setValue(0.72);
    const animation = Animated.spring(toggleScale, {
      damping: 12,
      mass: 0.55,
      stiffness: 220,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [isCompleted, toggleScale]);

  useEffect(() => {
    const animation = Animated.timing(overlayProgress, {
      duration: 150,
      toValue: completionPending ? 1 : 0,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [completionPending, overlayProgress]);

  return (
    <View style={styles.cardShadow}>
      <View
        accessibilityElementsHidden={completionPending}
        importantForAccessibility={
          completionPending ? 'no-hide-descendants' : 'auto'
        }
        style={[
          styles.card,
          colorfulAccents && { borderLeftWidth: 4, borderLeftColor: cardAccent },
          isCompleted && styles.cardCompleted,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.completedBackground,
            { opacity: completionProgress },
          ]}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted }}
          accessibilityLabel={t('task.mark', { title: task.title })}
          onPress={handleToggle}
          style={styles.checkButton}
        >
          <Animated.View style={{ transform: [{ scale: toggleScale }] }}>
            <MaterialIcons
              name={isCompleted ? 'check-circle' : 'radio-button-unchecked'}
              size={24}
              color={isCompleted ? colors.primary : colors.textMuted}
            />
          </Animated.View>
        </Pressable>

        <Pressable
          disabled={completionPending}
          onPress={handleEdit}
          style={styles.content}
        >
          <View style={styles.timeRow}>
            <Text style={[styles.time, isCompleted && styles.completedMeta]}>
              {task.startTime}
            </Text>
            {task.reminderMinutes !== null ? (
              <>
                <Text
                  style={[styles.meta, isCompleted && styles.completedMeta]}
                >
                  ·{' '}
                  {task.reminderMinutes === 0
                    ? t('task.reminderOnTime')
                    : t('task.reminderBefore', {
                        count: task.reminderMinutes,
                      })}
                </Text>
                <MaterialIcons
                  name="notifications"
                  size={14}
                  color={isCompleted ? colors.textMuted : colors.warning}
                />
              </>
            ) : null}
            {task.batchId ? (
              <View style={styles.batchBadge}>
                <MaterialIcons
                  name="repeat"
                  size={12}
                  color={isCompleted ? colors.textMuted : colors.primaryDark}
                />
                <Text
                  style={[
                    styles.batchBadgeText,
                    isCompleted && styles.completedMeta,
                  ]}
                >
                  {t('task.batchBadge')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={2}
            style={[styles.title, isCompleted && styles.completedText]}
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
            disabled={completionPending}
            onPress={handleDelete}
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
      <Animated.View
        accessibilityElementsHidden={!completionPending}
        importantForAccessibility={
          completionPending ? 'auto' : 'no-hide-descendants'
        }
        pointerEvents={completionPending ? 'auto' : 'none'}
        style={[styles.completionOverlay, { opacity: overlayProgress }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('task.undoCompletion', { title: task.title })}
          disabled={!completionPending}
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.completionOverlayPressable,
            pressed && styles.completionOverlayPressed,
          ]}
        >
          <View pointerEvents="none" style={styles.completionOverlayMessage}>
            <MaterialIcons name="undo" size={19} color={colors.primary} />
            <Text style={styles.completionOverlayText}>
              {t('task.completionPending')}
            </Text>
            <Text style={styles.completionCountdown}>
              {completionUndoSeconds ?? 1}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
});

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
    position: 'relative',
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
  completedBackground: {
    backgroundColor: colors.surfaceMuted,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
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
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  time: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  completedMeta: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20, marginTop: 4 },
  completedText: { color: colors.textMuted, textDecorationLine: 'line-through' },
  batchBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 9,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  batchBadgeText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  actions: { alignItems: 'flex-end', justifyContent: 'flex-end', marginLeft: 8 },
  smallButton: { borderRadius: 9, height: 30, width: 30 },
  completionOverlay: {
    backgroundColor: colors.subtleOverlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 3,
  },
  completionOverlayPressable: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  completionOverlayPressed: {
    opacity: 0.75,
  },
  completionOverlayMessage: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  completionOverlayText: {
    color: colors.primaryDark,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  completionCountdown: {
    backgroundColor: colors.primarySoft,
    borderRadius: 9,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    minWidth: 28,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 3,
    textAlign: 'center',
  },
});
