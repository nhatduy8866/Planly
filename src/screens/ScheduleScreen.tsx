import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { useTaskActions } from '../hooks/useTaskActions';
import { usePlanner } from '../store/PlannerContext';
import { colors } from '../theme/colors';
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
  const insets = useSafeAreaInsets();
  const { state, dispatch } = usePlanner();
  const { deleteTask, duplicateTask, saveTask, toggleTask } = useTaskActions();
  const [mode, setMode] = useState<CalendarMode>('week');
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [cursor, setCursor] = useState(() => new Date());
  const [formVisible, setFormVisible] = useState(false);
  const [sortMode, setSortMode] = useState<'time' | 'title' | 'priority'>('time');
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deletingTask, setDeletingTask] = useState<Task | undefined>();

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

  function goToday() {
    setSelectedDate(todayKey());
    setCursor(new Date());
  }

  function confirmDelete(task: Task) {
    setDeletingTask(task);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.navigationShell, { paddingTop: insets.top }]}>
        <View style={styles.navigationBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuExpanded ? 'Đóng chọn kiểu lịch' : 'Mở chọn kiểu lịch'}
            accessibilityState={{ expanded: menuExpanded }}
            onPress={() => {
              setMenuExpanded((expanded) => !expanded);
              void Haptics.selectionAsync();
            }}
            style={({ pressed }) => [
              styles.menuButton,
              menuExpanded && styles.menuButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="menu" size={25} color={colors.primaryDark} />
          </Pressable>

          <View pointerEvents="none" style={styles.centerIconWrap}>
            <View style={styles.centerIcon}>
              <MaterialIcons name="calendar-month" size={23} color={colors.primaryDark} />
            </View>
          </View>

          <Pressable onPress={goToday} style={styles.todayButton}>
            <Text style={styles.todayText}>Hôm nay</Text>
          </Pressable>
        </View>

        {menuExpanded ? (
          <View style={styles.navigationDropdown}>
            <View style={styles.segment}>
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
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {item === 'week' ? 'Tuần' : 'Tháng'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <IconButton
              icon="chevron-left"
              accessibilityLabel="Kỳ trước"
              onPress={() => navigate(-1)}
              backgroundColor="transparent"
            />
            <Text style={styles.monthTitle}>{formatMonthTitle(cursor)}</Text>
            <IconButton
              icon="chevron-right"
              accessibilityLabel="Kỳ sau"
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
            <Text style={styles.dayTitle}>{formatLongDate(selectedDate)}</Text>
            <Text style={styles.taskCount}>
              {dayTasks.length ? `${dayTasks.length} công việc` : 'Chưa có công việc'}
            </Text>
          </View>
          {dayTasks.length > 1 ? (
            <SortDropdown
              options={[
                { key: 'time', label: 'Theo giờ', icon: 'schedule' },
                { key: 'priority', label: 'Theo ưu tiên', icon: 'flag' },
                { key: 'title', label: 'Theo tên', icon: 'sort-by-alpha' },
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
        </View>

        {dayTasks.length ? (
          dayTasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => void toggleTask(task)}
              onEdit={() => openEdit(task)}
              onDuplicate={() => void duplicateTask(task)}
              onDelete={() => confirmDelete(task)}
              onMoveUp={() => {
                dispatch({ type: 'move_task', payload: { id: task.id, direction: -1 } });
                void Haptics.selectionAsync();
              }}
              onMoveDown={() => {
                dispatch({ type: 'move_task', payload: { id: task.id, direction: 1 } });
                void Haptics.selectionAsync();
              }}
              disableMoveUp={index === 0}
              disableMoveDown={index === dayTasks.length - 1}
            />
          ))
        ) : (
          <EmptyState
            icon="event-available"
            title="Ngày này đang trống"
            description="Thêm một công việc để bắt đầu sắp xếp ngày của bạn."
            actionLabel="Thêm công việc"
            onAction={openCreate}
          />
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thêm công việc"
        onPress={openCreate}
        style={({ pressed }) => [
          styles.fab,
          { bottom: 18 },
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="add" size={27} color={colors.white} />
      </Pressable>

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
        title="Xóa công việc?"
        message={`“${deletingTask?.title ?? ''}” sẽ bị xóa khỏi lịch.`}
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

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 96, paddingHorizontal: 16 },
  navigationShell: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    zIndex: 10,
  },
  navigationBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  menuButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  menuButtonActive: { backgroundColor: colors.surfaceMuted },
  centerIconWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  centerIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 11,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  todayButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  todayText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  navigationDropdown: { paddingBottom: 12, paddingHorizontal: 16 },
  segment: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 13,
    flexDirection: 'row',
    padding: 3,
  },
  segmentItem: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 9 },
  segmentItemActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: colors.primaryDark },
  calendarCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: 8 },
  monthTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 24,
  },
  listTitleWrap: { flex: 1 },
  dayTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  taskCount: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  fab: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 28,
    elevation: 5,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    shadowColor: colors.shadow,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    width: 56,
  },
  pressed: { opacity: 0.7 },
});
