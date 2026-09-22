import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import { CalendarPanel } from '../components/CalendarPanel';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import { SortDropdown, type SortOption } from '../components/SortDropdown';
import { TaskCard } from '../components/TaskCard';
import { AnimatedEntryItem } from '../components/animation/AnimatedEntryItem';
import { useReducedMotion } from '../components/animation/MotionProvider';
import {
  TaskFormModal,
  type TaskFormValues,
} from '../components/TaskFormModal';
import { AiScheduleModal } from '../components/ai/AiScheduleModal';
import { AiSaveSnackbar } from '../components/ai/AiSaveSnackbar';
import { useAiScheduler } from '../hooks/useAiScheduler';
import { useMinuteClock } from '../hooks/useMinuteClock';
import { useTaskActions } from '../hooks/useTaskActions';
import { useCalendarNavigation } from '../navigation/CalendarNavigationContext';
import { useTaskNavigation } from '../navigation/TaskNavigationContext';
import { usePreferences } from '../preferences/PreferencesContext';
import {
  usePlannerTasks,
} from '../store/PlannerContext';
import type { ThemeColors } from '../theme/colors';
import { MOTION } from '../theme/motion';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { CalendarMode, Task } from '../types';
import {
  addDays,
  formatMonthTitle,
  fromDateKey,
  toDateKey,
  todayKey,
} from '../utils/date';
import {
  getDefaultScheduleTaskView,
  groupScheduleTasksForView,
  type ScheduleTaskView,
} from '../utils/scheduleTasks';
import {
  compareTasks,
  nextTaskSortState,
  type TaskSortState,
} from '../utils/taskSorting';

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

const COMPLETION_UNDO_WINDOW_MS = 5_000;

interface PendingCompletion {
  committing: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
}

const TASK_LIST_TRANSITION = {
  create: {
    duration: MOTION.duration.standard,
    property: LayoutAnimation.Properties.opacity,
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    duration: MOTION.duration.standard,
    property: LayoutAnimation.Properties.opacity,
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  duration: MOTION.duration.standard,
  update: {
    duration: MOTION.duration.standard,
    type: LayoutAnimation.Types.easeInEaseOut,
  },
};

function animateTaskListTransition(reducedMotion: boolean) {
  if (reducedMotion) return;
  LayoutAnimation.configureNext(TASK_LIST_TRANSITION);
}

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
  const tasks = usePlannerTasks();
  const { colorfulAccents, colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const { deleteTask, saveTask, toggleTask } = useTaskActions();
  const { mode, registerTodayHandler } = useCalendarNavigation();
  const { registerTaskHandler } = useTaskNavigation();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [cursor, setCursor] = useState(() => new Date());
  const [formVisible, setFormVisible] = useState(false);
  const [formSession, setFormSession] = useState(0);
  const [taskSort, setTaskSort] = useState<
    TaskSortState<'time' | 'title' | 'priority'>
  >({ direction: 'ascending', key: 'time' });
  const [taskView, setTaskView] = useState<ScheduleTaskView>('upcoming');
  const [currentTime, refreshCurrentTime] = useMinuteClock(
    selectedDate === todayKey(),
  );
  const [pendingCompletionTaskIds, setPendingCompletionTaskIds] = useState<
    Set<string>
  >(() => new Set());
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deletingTask, setDeletingTask] = useState<Task | undefined>();
  const [deleteBatch, setDeleteBatch] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string>();
  const latestTasksRef = useRef(tasks);
  const pendingCompletionsRef = useRef<Map<string, PendingCompletion>>(new Map());
  const scrollViewRef = useRef<ScrollView>(null);
  const taskLayoutYRef = useRef(new Map<string, number>());
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const screenActiveRef = useRef(true);
  const calendarPeriodColorIndex = getCalendarPeriodColorIndex(cursor, mode);
  const calendarHeaderBackground = colorfulAccents
    ? colors[CALENDAR_HEADER_BACKGROUND_KEYS[calendarPeriodColorIndex]]
    : colors.surfaceMuted;
  const calendarHeaderBorder = colorfulAccents
    ? colors[CALENDAR_HEADER_BORDER_KEYS[calendarPeriodColorIndex]]
    : colors.border;

  const selectDate = useCallback((date: string) => {
    const now = new Date();
    animateTaskListTransition(reducedMotion);
    setSelectedDate(date);
    setCursor(fromDateKey(date));
    setTaskView(getDefaultScheduleTaskView(date, now));
    refreshCurrentTime();
  }, [reducedMotion, refreshCurrentTime]);

  const goToday = useCallback(() => {
    selectDate(todayKey());
  }, [selectDate]);

  useEffect(
    () => registerTodayHandler(goToday),
    [goToday, registerTodayHandler],
  );

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    latestTasksRef.current = tasks;
  }, [tasks]);

  const scrollToTask = useCallback((taskId: string) => {
    const taskY = taskLayoutYRef.current.get(taskId);
    if (taskY === undefined) return;
    scrollViewRef.current?.scrollTo({
      animated: !reducedMotion,
      y: Math.max(0, taskY - 16),
    });
  }, [reducedMotion]);

  const focusTaskFromNotification = useCallback(
    (taskId: string) => {
      const task = latestTasksRef.current.find((item) => item.id === taskId);
      if (!task) return;

      animateTaskListTransition(reducedMotion);
      setSelectedDate(task.date);
      setCursor(fromDateKey(task.date));
      setTaskView('all');
      refreshCurrentTime();
      setHighlightedTaskId(task.id);

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        if (screenActiveRef.current) setHighlightedTaskId(undefined);
      }, 3_500);
      requestAnimationFrame(() => scrollToTask(task.id));
    },
    [reducedMotion, refreshCurrentTime, scrollToTask],
  );

  useEffect(
    () => registerTaskHandler(focusTaskFromNotification),
    [focusTaskFromNotification, registerTaskHandler],
  );

  useEffect(() => {
    screenActiveRef.current = true;
    const pendingCompletions = pendingCompletionsRef.current;

    return () => {
      screenActiveRef.current = false;
      pendingCompletions.forEach(({ timeoutId }) => clearTimeout(timeoutId));
      pendingCompletions.clear();
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const aiScheduler = useAiScheduler(selectedDate, selectDate);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.date === selectedDate)
        .sort((first, second) =>
          compareTasks(
            first,
            second,
            taskSort.key,
            taskSort.direction,
            locale,
          ),
        ),
    [locale, selectedDate, taskSort, tasks],
  );

  const taskGroups = useMemo(
    () => groupScheduleTasksForView(dayTasks, selectedDate, currentTime),
    [currentTime, dayTasks, selectedDate],
  );
  const visibleDayTasks = taskGroups[taskView];

  const taskViewOptions: SortOption<ScheduleTaskView>[] = [
    {
      key: 'upcoming',
      label: t('schedule.upcomingTasks', { count: taskGroups.upcoming.length }),
      icon: 'schedule',
    },
    {
      key: 'past',
      label: t('schedule.pastTasks', { count: taskGroups.past.length }),
      icon: 'history',
    },
    {
      key: 'all',
      label: t('schedule.allTasks', { count: taskGroups.all.length }),
      icon: 'view-list',
    },
  ];

  function openCreate() {
    setEditingTask(undefined);
    setFormSession((current) => current + 1);
    setFormVisible(true);
  }

  const openEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setFormSession((current) => current + 1);
    setFormVisible(true);
  }, []);

  const confirmDelete = useCallback((task: Task) => {
    setDeleteBatch(false);
    setDeletingTask(task);
  }, []);

  function navigate(amount: -1 | 1) {
    const current = fromDateKey(selectedDate);
    const next = mode === 'week' ? addDays(current, amount * 7) : shiftMonth(current, amount);
    selectDate(toDateKey(next));
  }

  async function handleSave(values: TaskFormValues) {
    await saveTask(values, editingTask);
    const firstCreatedDate = values.batchDates?.[0] ?? values.date;
    selectDate(firstCreatedDate);
  }

  const removePendingCompletion = useCallback((taskId: string) => {
    if (!screenActiveRef.current) return;

    setPendingCompletionTaskIds((current) => {
      if (!current.has(taskId)) return current;
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, []);

  const commitPendingCompletion = useCallback(async (taskId: string) => {
    const pending = pendingCompletionsRef.current.get(taskId);
    if (!pending) return;

    pending.committing = true;
    const latestTask = latestTasksRef.current.find((task) => task.id === taskId);

    try {
      if (latestTask && !latestTask.completed) {
        animateTaskListTransition(reducedMotion);
        await toggleTask(latestTask);
      }
    } finally {
      pendingCompletionsRef.current.delete(taskId);
      removePendingCompletion(taskId);
    }
  }, [reducedMotion, removePendingCompletion, toggleTask]);

  const handleTaskToggle = useCallback((task: Task) => {
    const pending = pendingCompletionsRef.current.get(task.id);

    if (pending) {
      if (!pending.committing) {
        clearTimeout(pending.timeoutId);
        pendingCompletionsRef.current.delete(task.id);
        removePendingCompletion(task.id);
      }
      return;
    }

    if (task.completed) {
      animateTaskListTransition(reducedMotion);
      void toggleTask(task);
      return;
    }

    const timeoutId = setTimeout(() => {
      void commitPendingCompletion(task.id);
    }, COMPLETION_UNDO_WINDOW_MS);

    pendingCompletionsRef.current.set(task.id, {
      committing: false,
      timeoutId,
    });
    setPendingCompletionTaskIds((current) =>
      new Set(current).add(task.id),
    );
  }, [commitPendingCompletion, reducedMotion, removePendingCompletion, toggleTask]);
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
      >
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
            tasks={tasks}
            onSelectDate={selectDate}
          />
        </View>

        <View style={styles.listHeader}>
          <View style={styles.taskViewPicker}>
            <SortDropdown<ScheduleTaskView>
              accessibilityLabel={t('schedule.taskView')}
              buttonIcon="filter-list"
              fullWidth
              options={taskViewOptions}
              selectedKey={taskView}
              onSelect={(nextView) => {
                animateTaskListTransition(reducedMotion);
                setTaskView(nextView);
                refreshCurrentTime();
              }}
            />
          </View>
          {dayTasks.length > 1 ? (
            <View style={styles.taskSortPicker}>
              <SortDropdown<'time' | 'title' | 'priority'>
                direction={taskSort.direction}
                fullWidth
                options={[
                  { key: 'time', label: t('sort.time'), icon: 'schedule' },
                  { key: 'priority', label: t('sort.priority'), icon: 'flag' },
                  { key: 'title', label: t('sort.title'), icon: 'sort-by-alpha' },
                ]}
                selectedKey={taskSort.key}
                onSelect={(key) => {
                  animateTaskListTransition(reducedMotion);
                  setTaskSort((current) => nextTaskSortState(current, key));
                }}
              />
            </View>
          ) : null}
        </View>

        {visibleDayTasks.length ? (
          visibleDayTasks.map((task, index) => {
            const completionPending = pendingCompletionTaskIds.has(task.id);

            return (
              <View
                key={task.id}
                onLayout={({ nativeEvent }) => {
                  taskLayoutYRef.current.set(task.id, nativeEvent.layout.y);
                  if (highlightedTaskId === task.id) scrollToTask(task.id);
                }}
              >
                <AnimatedEntryItem
                  index={index}
                  triggerKey={`${selectedDate}-${taskView}-${taskSort.key}-${taskSort.direction}`}
                >
                  <TaskCard
                    completionPending={completionPending}
                    highlighted={
                      highlightedTaskId === task.id ||
                      aiScheduler.highlightedTaskIds.has(task.id)
                    }
                    task={task}
                    onToggle={handleTaskToggle}
                    onEdit={openEdit}
                    onDelete={confirmDelete}
                  />
                </AnimatedEntryItem>
              </View>
            );
          })
        ) : (
          <EmptyState
            icon={
              taskView === 'past'
                ? 'history'
                : taskView === 'all'
                  ? 'event-note'
                  : 'event-available'
            }
            title={t(
              taskView === 'past'
                ? 'schedule.pastEmptyTitle'
                : taskView === 'all'
                  ? 'schedule.emptyTitle'
                  : 'schedule.upcomingEmptyTitle',
            )}
            primaryActionLabel={
              taskView !== 'past' ? t('schedule.aiAction') : undefined
            }
            primaryActionIcon={taskView !== 'past' ? 'auto-awesome' : undefined}
            onPrimaryAction={
              taskView !== 'past' ? aiScheduler.openDirectPrompt : undefined
            }
          />
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('schedule.addTask')}
        onPress={aiScheduler.openActionSheet}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <MaterialIcons name="add" size={56} color={colors.white} />
      </Pressable>

      <AiScheduleModal
        scheduler={aiScheduler}
        targetDate={selectedDate}
        onOpenManualTaskModal={openCreate}
      />

      <AiSaveSnackbar
        action={
          aiScheduler.saveFeedback?.tasks.some(
            (task) => task.date !== selectedDate,
          )
            ? 'view'
            : 'undo'
        }
        busy={aiScheduler.undoingSave}
        feedback={aiScheduler.saveFeedback}
        onAction={() => {
          const differentDate = aiScheduler.saveFeedback?.tasks.find(
            (task) => task.date !== selectedDate,
          )?.date;
          if (differentDate) aiScheduler.viewSavedTasks(differentDate);
          else void aiScheduler.undoLastSave();
        }}
        onDismiss={aiScheduler.dismissSaveFeedback}
      />

      <TaskFormModal
        key={formSession}
        visible={formVisible}
        task={editingTask}
        defaultDate={selectedDate}
        onClose={() => setFormVisible(false)}
        onSubmit={handleSave}
      />

      <ConfirmModal
        visible={Boolean(deletingTask)}
        title={t('schedule.deleteTitle')}
        message={t('schedule.deleteMessage', { title: deletingTask?.title ?? '' })}
        optionChecked={deleteBatch}
        optionDescription={
          deletingTask?.batchId ? t('task.deleteBatchDescription') : undefined
        }
        optionLabel={
          deletingTask?.batchId ? t('task.deleteBatch') : undefined
        }
        onOptionChange={setDeleteBatch}
        onConfirm={() => {
          if (deletingTask) {
            animateTaskListTransition(reducedMotion);
            void deleteTask(deletingTask, deleteBatch);
            setDeletingTask(undefined);
            setDeleteBatch(false);
          }
        }}
        onCancel={() => {
          setDeletingTask(undefined);
          setDeleteBatch(false);
        }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 144, paddingHorizontal: 16 },
  calendarCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
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
    gap: 8,
    marginBottom: 12,
    marginTop: 24,
  },
  taskViewPicker: {
    flex: 1,
    minWidth: 0,
    width: 0,
  },
  taskSortPicker: {
    flex: 1,
    minWidth: 0,
    width: 0,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 56,
    bottom: 16,
    elevation: 6,
    height: 112,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    shadowColor: colors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    width: 112,
    zIndex: 10,
  },
  pressed: { opacity: MOTION.pressedOpacity },
});
