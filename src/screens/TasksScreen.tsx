import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { TaskCard } from '../components/TaskCard';
import {
  TaskFormModal,
  type TaskFormValues,
} from '../components/TaskFormModal';
import { useTaskActions } from '../hooks/useTaskActions';
import { usePlanner } from '../store/PlannerContext';
import { colors } from '../theme/colors';
import type { Task } from '../types';
import { formatLongDate, timeToMinutes, todayKey } from '../utils/date';

type TaskFilter = 'pending' | 'all' | 'completed';

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'pending', label: 'Cần làm' },
  { key: 'all', label: 'Tất cả' },
  { key: 'completed', label: 'Đã xong' },
];

export function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { state } = usePlanner();
  const { deleteTask, duplicateTask, saveTask, toggleTask } = useTaskActions();
  const [filter, setFilter] = useState<TaskFilter>('pending');
  const [query, setQuery] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  const groupedTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    const filtered = state.tasks
      .filter((task) => {
        if (filter === 'pending' && task.completed) return false;
        if (filter === 'completed' && !task.completed) return false;
        if (!normalizedQuery) return true;
        return `${task.title} ${task.description}`
          .toLocaleLowerCase('vi-VN')
          .includes(normalizedQuery);
      })
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
      );

    return filtered.reduce<{ date: string; tasks: Task[] }[]>((groups, task) => {
      const last = groups.at(-1);
      if (last?.date === task.date) last.tasks.push(task);
      else groups.push({ date: task.date, tasks: [task] });
      return groups;
    }, []);
  }, [filter, query, state.tasks]);

  function openCreate() {
    setEditingTask(undefined);
    setFormVisible(true);
  }

  function confirmDelete(task: Task) {
    Alert.alert('Xóa công việc?', `“${task.title}” sẽ bị xóa khỏi lịch.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => void deleteTask(task) },
    ]);
  }

  async function handleSave(values: TaskFormValues) {
    await saveTask(values, editingTask);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TẬP TRUNG HÔM NAY</Text>
            <Text style={styles.screenTitle}>Công việc</Text>
          </View>
          <Pressable onPress={openCreate} style={styles.addButton}>
            <MaterialIcons name="add" size={21} color={colors.white} />
            <Text style={styles.addText}>Thêm</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={21} color={colors.textMuted} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Tìm công việc"
            placeholderTextColor="#969E97"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <MaterialIcons name="cancel" size={19} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filter, active && styles.filterActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {groupedTasks.length ? (
          groupedTasks.map((group) => (
            <View key={group.date} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{formatLongDate(group.date)}</Text>
                {group.date < todayKey() ? (
                  <Text style={styles.overdue}>Đã qua</Text>
                ) : null}
              </View>
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  compact
                  task={task}
                  onToggle={() => void toggleTask(task)}
                  onEdit={() => {
                    setEditingTask(task);
                    setFormVisible(true);
                  }}
                  onDuplicate={() => void duplicateTask(task)}
                  onDelete={() => confirmDelete(task)}
                />
              ))}
            </View>
          ))
        ) : (
          <EmptyState
            icon="task-alt"
            title={query ? 'Không tìm thấy công việc' : 'Danh sách đang trống'}
            description={
              query
                ? 'Thử một từ khóa khác hoặc đổi bộ lọc.'
                : 'Tạo công việc đầu tiên để bắt đầu kế hoạch.'
            }
            actionLabel={query ? undefined : 'Tạo công việc'}
            onAction={query ? undefined : openCreate}
          />
        )}
      </ScrollView>

      {formVisible ? (
        <TaskFormModal
          visible
          task={editingTask}
          defaultDate={todayKey()}
          onClose={() => setFormVisible(false)}
          onSubmit={handleSave}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  screenTitle: { color: colors.text, fontSize: 29, fontWeight: '800', marginTop: 3 },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  addText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    paddingHorizontal: 13,
  },
  searchInput: { color: colors.text, flex: 1, fontSize: 14, paddingHorizontal: 9, paddingVertical: 12 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 13 },
  filter: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterActive: { backgroundColor: colors.primarySoft },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: colors.primaryDark },
  group: { marginTop: 22 },
  groupHeader: { alignItems: 'center', flexDirection: 'row', marginBottom: 9 },
  groupTitle: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '800' },
  overdue: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    color: colors.danger,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
