import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CalendarPanel } from '../components/CalendarPanel';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { SortDropdown } from '../components/SortDropdown';
import { TaskCard } from '../components/TaskCard';
import {
  TaskFormModal,
  type TaskFormValues,
} from '../components/TaskFormModal';
import { AiScheduleModal } from '../components/ai/AiScheduleModal';
import { useAiScheduler } from '../hooks/useAiScheduler';
import { useTaskActions } from '../hooks/useTaskActions';
import { useCalendarNavigation } from '../navigation/CalendarNavigationContext';
import { usePreferences } from '../preferences/PreferencesContext';
import { usePlanner } from '../store/PlannerContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { CalendarMode, Task } from '../types';
import {
  addDays,
  formatLongDate,
  formatMonthTitle,
  fromDateKey,
  timeToMinutes,
  toDateKey,
  todayKey,
} from '../utils/date';

const CALENDAR_HEADER_BACKGROUND_KEYS = [
  'calendarHeaderLavender',
  'calendarHeaderBlue',
  'calendarHeaderMint',
  'calendarHeaderAmber',
  'calendarHeaderPink',
  'calendarHeaderPurple',
  'calendarHeaderPeach',
  'calendarHeaderLime',
  'calendarHeaderCyan',
  'calendarHeaderRose',
  'calendarHeaderYellow',
  'calendarHeaderSlate',
] as const satisfies readonly (keyof ThemeColors)[];

const CALENDAR_HEADER_BORDER_KEYS = [
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

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function getCalendarPeriodColorIndex(cursor: Date, mode: CalendarMode): number {
  if (mode === 'month') {
    return positiveModulo(
      cursor.getFullYear() * 12 + cursor.getMonth(),
      CALENDAR_HEADER_BACKGROUND_KEYS.length,
    );
  }

  const monday = addDays(cursor, -((cursor.getDay() + 6) % 7));
  const mondayUtcDay = Math.floor(
    Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) /
      (24 * 60 * 60 * 1000),
  );

  return positiveModulo(
    Math.floor(mondayUtcDay / 7),
    CALENDAR_HEADER_BACKGROUND_KEYS.length,
  );
}

function shiftMonth(date: Date, amount: number): Date {
  const targetMonth = date.getMonth() + amount;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(
    date.getFullYear(),
    targetMonth,
    Math.min(date.getDate(), lastDay),
  );
}

export function ScheduleScreen() {
  const { state, dispatch } = usePlanner();
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const { deleteTask, saveTask, toggleTask } = useTaskActions();
  const { mode, registerTodayHandler, setMode } = useCalendarNavigation();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [cursor, setCursor] = useState(() => new Date());
  const [formVisible, setFormVisible] = useState(false);
  const [sortMode, setSortMode] = useState<'time' | 'title' | 'priority'>('time');
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deletingTask, setDeletingTask] = useState<Task | undefined>();
  const calendarPeriodColorIndex = getCalendarPeriodColorIndex(cursor, mode);
  const calendarHeaderBackground =
    colors[CALENDAR_HEADER_BACKGROUND_KEYS[calendarPeriodColorIndex]];
  const calendarHeaderBorder =
    colors[CALENDAR_HEADER_BORDER_KEYS[calendarPeriodColorIndex]];

  const goToday = useCallback(() => {
    setSelectedDate(todayKey());
    setCursor(new Date());
  }, []);

  useEffect(
    () => registerTodayHandler(goToday),
    [goToday, registerTodayHandler],
  );

  const handleAiNavigateDate = useCallback((date: string) => {
    setSelectedDate(date);
    setCursor(fromDateKey(date));
  }, []);

  const aiScheduler = useAiScheduler(selectedDate, handleAiNavigateDate);

  const dayTasks = useMemo(
    () =>
      state.tasks
        .filter((task) => task.date === selectedDate)
        .sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) ||
            timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
            a.createdAt.localeCompare(b.createdAt),
        ),
    [selectedDate, state.tasks],
  );

  function openCreate() {
    setEditingTask(undefined);
    setFormVisible(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setFormVisible(true);
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setCursor(fromDateKey(date));
  }

  function navigate(amount: -1 | 1) {
    const current = fromDateKey(selectedDate);
    const next = mode === 'week' ? addDays(current, amount * 7) : shiftMonth(current, amount);
    selectDate(toDateKey(next));
  }

  async function handleSave(values: TaskFormValues) {
    await saveTask(values, editingTask);
    setSelectedDate(values.date);
    setCursor(fromDateKey(values.date));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function confirmDelete(task: Task) {
    setDeletingTask(task);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarModeToggle}>
          {(['week', 'month'] as const).map((item) => {
            const active = mode === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setMode(item);
                  void Haptics.selectionAsync();
                }}
                style={[styles.calendarModeItem, active && styles.calendarModeItemActive]}
              >
                <Text
                  style={[
                    styles.calendarModeText,
                    active && styles.calendarModeTextActive,
                  ]}
                >
                  {t(item === 'week' ? 'calendar.week' : 'calendar.month')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.calendarCard}>
          <View
            style={[
              styles.calendarHeader,
              {
                backgroundColor: calendarHeaderBackground,
                borderColor: calendarHeaderBorder,
              },
            ]}
          >
            <IconButton
              icon="chevron-left"
              accessibilityLabel={t('schedule.previous')}
              onPress={() => navigate(-1)}
              backgroundColor="transparent"
            />
            <Text style={styles.monthTitle}>{formatMonthTitle(cursor, locale)}</Text>
            <IconButton
              icon="chevron-right"
              accessibilityLabel={t('schedule.next')}
              onPress={() => navigate(1)}
              backgroundColor="transparent"
            />
          </View>
          <CalendarPanel
            mode={mode}
            cursor={cursor}
            selectedDate={selectedDate}
            tasks={state.tasks}
            onSelectDate={selectDate}
          />
        </View>

        <View style={styles.listHeader}>
          <View style={styles.listTitleWrap}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              style={styles.dayTitle}
            >
              {formatLongDate(selectedDate, locale)}
            </Text>
            <Text style={styles.taskCount}>
              {dayTasks.length
                ? t('schedule.taskCount', { count: dayTasks.length })
                : t('schedule.noTasks')}
            </Text>
          </View>
          {dayTasks.length ? (
            <View style={styles.listActions}>
              {dayTasks.length > 1 ? (
                <SortDropdown
                  options={[
                    { key: 'time', label: t('sort.time'), icon: 'schedule' },
                    { key: 'priority', label: t('sort.priority'), icon: 'flag' },
                    { key: 'title', label: t('sort.title'), icon: 'sort-by-alpha' },
                  ]}
                  selectedKey={sortMode}
                  onSelect={(key) => {
                    const nextSort = key as 'time' | 'title' | 'priority';
                    setSortMode(nextSort);
                    dispatch({
                      type: 'sort_day',
                      payload: { date: selectedDate, by: nextSort },
                    });
                    void Haptics.selectionAsync();
                  }}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('schedule.addTask')}
                onPress={aiScheduler.openActionSheet}
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="add" size={18} color={colors.white} />
                <Text style={styles.addButtonText}>{t('schedule.addTask')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {dayTasks.length ? (
          dayTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => void toggleTask(task)}
              onEdit={() => openEdit(task)}
              onDelete={() => confirmDelete(task)}
            />
          ))
        ) : (
          <EmptyState
            icon="event-available"
            title={t('schedule.emptyTitle')}
            description={t('schedule.emptyDescription')}
            primaryActionLabel={t('schedule.aiAction')}
            primaryActionIcon="auto-awesome"
            onPrimaryAction={aiScheduler.openDirectPrompt}
            actionLabel={t('schedule.addTask')}
            onAction={openCreate}
          />
        )}
      </ScrollView>

      <AiScheduleModal
        scheduler={aiScheduler}
        targetDate={selectedDate}
        onOpenManualTaskModal={openCreate}
      />

      {formVisible ? (
        <TaskFormModal
          visible
          task={editingTask}
          defaultDate={selectedDate}
          onClose={() => setFormVisible(false)}
          onSubmit={handleSave}
        />
      ) : null}

      <ConfirmModal
        visible={Boolean(deletingTask)}
        title={t('schedule.deleteTitle')}
        message={t('schedule.deleteMessage', { title: deletingTask?.title ?? '' })}
        onConfirm={() => {
          if (deletingTask) {
            void deleteTask(deletingTask);
            setDeletingTask(undefined);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }}
        onCancel={() => setDeletingTask(undefined)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  calendarModeToggle: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 13,
    flexDirection: 'row',
    marginTop: 16,
    padding: 3,
  },
  calendarModeItem: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 9,
  },
  calendarModeItemActive: {
    backgroundColor: colors.surface,
  },
  calendarModeText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  calendarModeTextActive: {
    color: colors.primaryDark,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
    padding: 12,
  },
  calendarHeader: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  monthTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    marginTop: 24,
  },
  listTitleWrap: { flex: 1, minWidth: 0 },
  dayTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  taskCount: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  listActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
    justifyContent: 'flex-end',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
