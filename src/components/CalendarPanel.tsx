import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
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

const MONDAY_FIRST_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function TaskDots({ count }: { count: number }) {
  if (!count) return <View style={styles.dotSpacer} />;
  return (
    <View style={styles.dots}>
      {Array.from({ length: Math.min(count, 3) }, (_, index) => (
        <View key={index} style={styles.dot} />
      ))}
    </View>
  );
}

export function CalendarPanel({
  mode,
  cursor,
  selectedDate,
  tasks,
  onSelectDate,
}: CalendarPanelProps) {
  const taskCount = tasks.reduce<Record<string, number>>((count, task) => {
    count[task.date] = (count[task.date] ?? 0) + 1;
    return count;
  }, {});

  if (mode === 'week') {
    return (
      <View style={styles.weekRow}>
        {getWeekDays(cursor).map((date) => {
          const key = toDateKey(date);
          const selected = key === selectedDate;
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
              <Text style={[styles.weekLabel, selected && styles.selectedText]}>
                {getWeekdayShort(date)}
              </Text>
              <Text style={[styles.weekNumber, selected && styles.selectedText]}>
                {date.getDate()}
              </Text>
              <TaskDots count={taskCount[key] ?? 0} />
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.monthHeader}>
        {MONDAY_FIRST_LABELS.map((label) => (
          <Text key={label} style={styles.monthHeaderText}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {getMonthGrid(cursor).map((date) => {
          const key = toDateKey(date);
          const selected = key === selectedDate;
          const outsideMonth = date.getMonth() !== cursor.getMonth();
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
              <Text
                style={[
                  styles.monthNumber,
                  outsideMonth && styles.outsideMonth,
                  selected && styles.selectedText,
                ]}
              >
                {date.getDate()}
              </Text>
              <TaskDots count={taskCount[key] ?? 0} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 9,
  },
  selectedDay: { backgroundColor: colors.primary },
  selectedMonthDay: { backgroundColor: colors.primary },
  weekLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  weekNumber: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  selectedText: { color: colors.white },
  dotSpacer: { height: 5, marginTop: 7 },
  dots: { flexDirection: 'row', gap: 2, height: 5, marginTop: 7 },
  dot: { backgroundColor: colors.accent, borderRadius: 2, height: 4, width: 4 },
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
    width: '14.2857%',
  },
  monthNumber: { color: colors.text, fontSize: 13, fontWeight: '600' },
  outsideMonth: { color: '#B6BDB7' },
  pressed: { opacity: 0.65 },
});
