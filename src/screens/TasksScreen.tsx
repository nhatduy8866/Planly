import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { SortDropdown, type SortOption } from '../components/SortDropdown';
import { TaskCard } from '../components/TaskCard';
import { AnimatedEntryItem } from '../components/animation/AnimatedEntryItem';
import {
  TaskFormModal,
  type TaskFormValues,
} from '../components/TaskFormModal';
import { useTaskActions } from '../hooks/useTaskActions';
import { usePreferences } from '../preferences/PreferencesContext';
import { usePlanner } from '../store/PlannerContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Task } from '../types';
import { formatLongDate, timeToMinutes, todayKey } from '../utils/date';

type TaskFilter = 'today' | 'all' | 'completed';
type TaskSort = 'time' | 'priority' | 'title' | 'created';

const PRIORITY_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function TasksScreen() {
  const { state } = usePlanner();
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const { deleteTask, saveTask, toggleTask } = useTaskActions();
  const [filter, setFilter] = useState<TaskFilter>('today');
  const [sortBy, setSortBy] = useState<TaskSort>('time');
  const [query, setQuery] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [deletingTask, setDeletingTask] = useState<Task | undefined>();
  const filters: { key: TaskFilter; label: string }[] = [
    { key: 'today', label: t('tasks.filterToday') },
    { key: 'all', label: t('tasks.filterAll') },
    { key: 'completed', label: t('tasks.filterCompleted') },
  ];
  const sorts: SortOption<TaskSort>[] = [
    { key: 'time', label: t('sort.time'), icon: 'schedule' },
    { key: 'priority', label: t('sort.priority'), icon: 'flag' },
    { key: 'title', label: t('sort.title'), icon: 'sort-by-alpha' },
    { key: 'created', label: t('sort.created'), icon: 'access-time' },
  ];

  const groupedTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const currentDate = todayKey();
    const filtered = state.tasks
      .filter((task) => {
        if (filter === 'today' && task.date !== currentDate) return false;
        if (filter === 'completed' && !task.completed) return false;
        if (!normalizedQuery) return true;
        return `${task.title} ${task.description}`
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const weightA = PRIORITY_WEIGHT[a.priority ?? 'none'] ?? 0;
          const weightB = PRIORITY_WEIGHT[b.priority ?? 'none'] ?? 0;
          return (
            a.date.localeCompare(b.date) ||
            weightB - weightA ||
            timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
          );
        }
        if (sortBy === 'title') {
          return (
            a.date.localeCompare(b.date) ||
            a.title.localeCompare(b.title, locale) ||
            timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
          );
        }
        if (sortBy === 'created') {
          return (
            a.date.localeCompare(b.date) ||
            b.createdAt.localeCompare(a.createdAt)
          );
        }
        // Default: Theo ngày & giờ & thứ tự
        return (
          a.date.localeCompare(b.date) ||
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
          (a.order ?? 0) - (b.order ?? 0)
        );
      });

    return filtered.reduce<{ date: string; tasks: Task[] }[]>((groups, task) => {
      const last = groups.at(-1);
      if (last?.date === task.date) last.tasks.push(task);
      else groups.push({ date: task.date, tasks: [task] });
      return groups;
    }, []);
  }, [filter, locale, query, sortBy, state.tasks]);

  function openCreate() {
    setEditingTask(undefined);
    setFormVisible(true);
  }

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setFormVisible(true);
  }, []);

  const handleDeleteTask = useCallback((task: Task) => {
    setDeletingTask(task);
  }, []);

  const handleToggleTask = useCallback(
    (task: Task) => {
      void toggleTask(task);
    },
    [toggleTask],
  );

  async function handleSave(values: TaskFormValues) {
    await saveTask(values, editingTask);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={21} color={colors.textMuted} />
            <TextInput
              onChangeText={setQuery}
              placeholder={t('tasks.search')}
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}>
                <MaterialIcons name="cancel" size={19} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={openCreate} style={styles.addButton}>
            <MaterialIcons name="add" size={21} color={colors.white} />
            <Text style={styles.addText}>{t('common.add')}</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filters}>
            {filters.map((item) => {
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

          <SortDropdown<TaskSort>
            options={sorts}
            selectedKey={sortBy}
            onSelect={setSortBy}
          />
        </View>

        {groupedTasks.length ? (
          (() => {
            let globalIndex = 0;
            return groupedTasks.map((group) => (
              <View key={group.date} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{formatLongDate(group.date, locale)}</Text>
                  {group.date < todayKey() ? (
                    <Text style={styles.overdue}>{t('tasks.overdue')}</Text>
                  ) : null}
                </View>
                {group.tasks.map((task) => {
                  const itemIndex = globalIndex++;
                  return (
                    <AnimatedEntryItem
                      key={task.id}
                      index={itemIndex}
                      triggerKey={`${filter}-${sortBy}-${query}`}
                    >
                      <TaskCard
                        compact
                        task={task}
                        onToggle={handleToggleTask}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                      />
                    </AnimatedEntryItem>
                  );
                })}
              </View>
            ));
          })()
        ) : (
          <EmptyState
            icon="task-alt"
            title={t(query ? 'tasks.noResultsTitle' : 'tasks.emptyTitle')}
            description={
              t(query ? 'tasks.noResultsDescription' : 'tasks.emptyDescription')
            }
            actionLabel={query ? undefined : t('schedule.addTask')}
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

      <ConfirmModal
        visible={Boolean(deletingTask)}
        title={t('schedule.deleteTitle')}
        message={t('tasks.deleteMessage', { title: deletingTask?.title ?? '' })}
        onConfirm={() => {
          if (deletingTask) {
            void deleteTask(deletingTask);
            setDeletingTask(undefined);
          }
        }}
        onCancel={() => setDeletingTask(undefined)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 32, paddingHorizontal: 16, paddingTop: 14 },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
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
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 13,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 9,
    paddingVertical: 12,
  },
  searchRow: { flexDirection: 'row', gap: 10 },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 13,
  },
  filters: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filter: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
