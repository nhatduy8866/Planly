import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { CalendarMode, Task } from '../types';
import {
  getMonthGrid,
  getWeekDays,
  getWeekdayShort,
  toDateKey,
} from '../utils/date';

interface CalendarPanelProps {
  mode: CalendarMode;
  cursor: Date;
  selectedDate: string;
  tasks: Task[];
  onSelectDate: (date: string) => void;
}

function TaskCountBadge({
  count,
  selected,
  styles,
  visible,
}: {
  count: number;
  selected: boolean;
  styles: ReturnType<typeof createStyles>;
  visible: boolean;
}) {
  if (!visible) return null;
  if (!count) return <View style={styles.taskBadgeSpacer} />;

  return (
    <View style={[styles.taskBadge, selected && styles.taskBadgeSelected]}>
      <Text style={[styles.taskBadgeText, selected && styles.taskBadgeTextSelected]}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
}

export const CalendarPanel = memo(function CalendarPanel({
  mode,
  cursor,
  selectedDate,
  tasks,
  onSelectDate,
}: CalendarPanelProps) {
  const { locale, showTaskBadges } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const mondayFirstLabels = useMemo(
    () =>
      locale === 'vi-VN'
        ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
        : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    [locale],
  );
  const { highPriorityDates, taskCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    const highPriorities = new Set<string>();

    for (const task of tasks) {
      counts[task.date] = (counts[task.date] ?? 0) + 1;
      if (task.priority === 'high') {
        highPriorities.add(task.date);
      }
    }

    return { highPriorityDates: highPriorities, taskCount: counts };
  }, [tasks]);

  const weekDays = useMemo(() => getWeekDays(cursor), [cursor]);
  const monthGrid = useMemo(() => getMonthGrid(cursor), [cursor]);

  if (mode === 'week') {
    return (
      <View style={styles.weekRow}>
        {weekDays.map((date) => {
          const key = toDateKey(date);
          const selected = key === selectedDate;
          const hasHighPriority = highPriorityDates.has(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelectDate(key)}
              style={({ pressed }) => [
                styles.weekDay,
                selected && styles.selectedDay,
                pressed && styles.pressed,
              ]}
            >
              {hasHighPriority ? <View style={styles.highPriorityIndicator} /> : null}
              <Text style={[styles.weekLabel, selected && styles.selectedText]}>
                {getWeekdayShort(date, locale)}
              </Text>
              <Text style={[styles.weekNumber, selected && styles.selectedText]}>
                {date.getDate()}
              </Text>
              <TaskCountBadge
                count={taskCount[key] ?? 0}
                selected={selected}
                styles={styles}
                visible={showTaskBadges}
              />
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.monthHeader}>
        {mondayFirstLabels.map((label) => (
          <Text key={label} style={styles.monthHeaderText}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {monthGrid.map((date) => {
          const key = toDateKey(date);
          const selected = key === selectedDate;
          const outsideMonth = date.getMonth() !== cursor.getMonth();
          const hasHighPriority = highPriorityDates.has(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelectDate(key)}
              style={({ pressed }) => [
                styles.monthDay,
                selected && styles.selectedMonthDay,
                pressed && styles.pressed,
              ]}
            >
              {hasHighPriority ? <View style={styles.highPriorityIndicator} /> : null}
              <Text
                style={[
                  styles.monthNumber,
                  outsideMonth && styles.outsideMonth,
                  selected && styles.selectedText,
                ]}
              >
                {date.getDate()}
              </Text>
              <TaskCountBadge
                count={taskCount[key] ?? 0}
                selected={selected}
                styles={styles}
                visible={showTaskBadges}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    marginHorizontal: 2,
    overflow: 'hidden',
    paddingVertical: 9,
  },
  selectedDay: { backgroundColor: colors.primary },
  selectedMonthDay: { backgroundColor: colors.primary },
  highPriorityIndicator: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 18,
    borderStyle: 'solid',
    borderTopColor: colors.priorityHigh,
    borderTopWidth: 18,
    height: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 0,
  },
  weekLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  weekNumber: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  selectedText: { color: colors.white },
  taskBadgeSpacer: { height: 14, marginTop: 4 },
  taskBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 7,
    height: 14,
    justifyContent: 'center',
    marginTop: 4,
    width: '95%',
  },
  taskBadgeSelected: { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
  taskBadgeText: {
    color: colors.primaryDark,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  taskBadgeTextSelected: { color: colors.white },
  monthHeader: { flexDirection: 'row', marginBottom: 4 },
  monthHeaderText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthDay: {
    alignItems: 'center',
    borderRadius: 16,
    height: 45,
    justifyContent: 'center',
    marginVertical: 1,
    overflow: 'hidden',
    width: '14.2857%',
  },
  monthNumber: { color: colors.text, fontSize: 13, fontWeight: '600' },
  outsideMonth: { color: colors.placeholder },
  pressed: { opacity: 0.65 },
});
