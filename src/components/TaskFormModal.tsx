import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';
import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ReminderMinutes, Task, TaskPriority } from '../types';
import { fromDateKey, taskDateTime, toDateKey } from '../utils/date';
import { IconButton } from './IconButton';

export interface TaskFormValues {
  title: string;
  description: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  reminderMinutes: ReminderMinutes;
  priority: TaskPriority;
}

interface TaskFormModalProps {
  visible: boolean;
  task?: Task;
  defaultDate: string;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
}

const PRIORITY_OPTIONS: {
  value: TaskPriority;
  icon?: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { value: 'none' },
  { value: 'low', icon: 'arrow-downward' },
  { value: 'medium', icon: 'drag-handle' },
  { value: 'high', icon: 'error' },
];

const REMINDER_VALUES: ReminderMinutes[] = [null, 0, 5, 15, 30, 60];
const DURATION_PRESET_VALUES = [15, 30, 45, 60, 90, 120];

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export function TaskFormModal({
  visible,
  task,
  defaultDate,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, t, theme } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(task?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(task?.startTime ?? '09:00');
  const [duration, setDuration] = useState(String(task?.durationMinutes ?? 30));
  const [isCustomDuration, setIsCustomDuration] = useState(() => {
    const currentDuration = task?.durationMinutes ?? 30;
    return !DURATION_PRESET_VALUES.includes(currentDuration);
  });
  const [reminder, setReminder] = useState<ReminderMinutes>(
    task?.reminderMinutes ?? null,
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? 'none',
  );
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function handlePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPicker(null);
    if (event.type === 'dismissed' || !selected) return;
    if (picker === 'date') setDate(toDateKey(selected));
    if (picker === 'time') setStartTime(formatTime(selected));
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const parsedDuration = Number(duration);
    if (!trimmedTitle) {
      setError(t('taskForm.titleRequired'));
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration < 5) {
      setError(t('taskForm.durationInvalid'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        date,
        startTime,
        durationMinutes: Math.round(parsedDuration),
        reminderMinutes: reminder,
        priority,
      });
      onClose();
    } catch {
      setError(t('taskForm.saveError'));
    } finally {
      setSaving(false);
    }
  }

  const pickerValue =
    picker === 'date' ? fromDateKey(date) : taskDateTime(date, startTime);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={Platform.OS === 'web'}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 16 : Math.max(insets.top, 16) }]}>
              <IconButton
                icon="close"
                accessibilityLabel={t('common.close')}
                onPress={onClose}
                backgroundColor="transparent"
              />
              <Text style={styles.headerTitle}>
                {t(task ? 'taskForm.editTitle' : 'taskForm.newTitle')}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              >
                <Text style={styles.saveText}>
                  {t(saving ? 'common.saving' : 'common.save')}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
            <Text style={styles.label}>{t('taskForm.name')}</Text>
            <TextInput
              autoFocus={!task}
              maxLength={120}
              onChangeText={setTitle}
              placeholder={t('taskForm.namePlaceholder')}
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              value={title}
            />

            <Text style={styles.label}>{t('taskForm.description')}</Text>
            <TextInput
              maxLength={500}
              multiline
              onChangeText={setDescription}
              placeholder={t('taskForm.descriptionPlaceholder')}
              placeholderTextColor={colors.placeholder}
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
              value={description}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>{t('taskForm.date')}</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.webPickerBox}>
                    <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                    <input
                      type="date"
                      value={date}
                      onChange={(e: any) => setDate(e.target.value)}
                      style={{
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: '600',
                        width: '100%',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setPicker('date')}
                    style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
                  >
                    <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                    <Text style={styles.pickerText}>{date.split('-').reverse().join('/')}</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.half}>
                <Text style={styles.label}>{t('taskForm.start')}</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.webPickerBox}>
                    <MaterialIcons name="schedule" size={19} color={colors.primary} />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e: any) => setStartTime(e.target.value)}
                      style={{
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: '600',
                        width: '100%',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setPicker('time')}
                    style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
                  >
                    <MaterialIcons name="schedule" size={19} color={colors.primary} />
                    <Text style={styles.pickerText}>{startTime}</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text style={styles.label}>{t('taskForm.duration')}</Text>
            <View style={styles.chips}>
              {DURATION_PRESET_VALUES.map((value) => {
                const active = Number(duration) === value && !isCustomDuration;
                const label = value === 60
                  ? t('taskForm.oneHour')
                  : value > 60
                    ? t('taskForm.hours', { count: value / 60 })
                    : t('taskForm.minutes', { count: value });
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setDuration(String(value));
                      setIsCustomDuration(false);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setIsCustomDuration(true)}
                style={({ pressed }) => [
                  styles.chip,
                  isCustomDuration && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, isCustomDuration && styles.chipTextActive]}>
                  {t('taskForm.customDuration')}
                </Text>
              </Pressable>
            </View>

            {isCustomDuration ? (
              <View style={styles.customDurationWrap}>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={setDuration}
                  placeholder={t('taskForm.customDurationPlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  style={[styles.input, { marginTop: 8 }]}
                  value={duration}
                />
              </View>
            ) : null}

            <Text style={styles.label}>{t('taskForm.reminder')}</Text>
            <View style={styles.chips}>
              {REMINDER_VALUES.map((value) => {
                const active = value === reminder;
                const label = value === null
                  ? t('taskForm.reminderNone')
                  : value === 0
                    ? t('taskForm.onTime')
                    : value === 60
                      ? t('taskForm.oneHour')
                      : t('taskForm.minutes', { count: value });
                return (
                  <Pressable
                    key={String(value)}
                    onPress={() => setReminder(value)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>{t('taskForm.priority')}</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map((item) => {
                const active = item.value === priority;
                const color = item.value === 'high'
                  ? colors.priorityHigh
                  : item.value === 'medium'
                    ? colors.priorityMedium
                    : item.value === 'low'
                      ? colors.priorityLow
                      : colors.textMuted;
                const activeBg = item.value === 'high'
                  ? colors.priorityHighSoft
                  : item.value === 'medium'
                    ? colors.priorityMediumSoft
                    : item.value === 'low'
                      ? colors.priorityLowSoft
                      : colors.surfaceMuted;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      setPriority(item.value);
                      void Haptics.selectionAsync();
                    }}
                    style={({ pressed }) => [
                      styles.priorityChip,
                      active && {
                        backgroundColor: activeBg,
                        borderColor: color,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    {item.icon ? (
                      <MaterialIcons
                        name={item.icon}
                        size={14}
                        color={active ? color : colors.textMuted}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.priorityChipText,
                        active && { color, fontWeight: '800' },
                      ]}
                    >
                      {t(
                        item.value === 'high'
                          ? 'taskForm.priorityHigh'
                          : item.value === 'medium'
                            ? 'taskForm.priorityMedium'
                            : item.value === 'low'
                              ? 'taskForm.priorityLow'
                              : 'taskForm.priorityNone',
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {Platform.OS === 'android' && picker ? (
              <DateTimePicker
                mode={picker}
                value={pickerValue}
                minimumDate={picker === 'date' ? new Date(2020, 0, 1) : undefined}
                onChange={handlePickerChange}
              />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
        </View>
      </View>

      {Platform.OS === 'ios' && picker ? (
        <Modal transparent animationType="fade" visible={Boolean(picker)}>
          <View style={styles.iosPickerOverlay}>
            <View style={styles.iosPickerSheet}>
              <View style={styles.iosPickerHeader}>
                <Text style={styles.iosPickerTitle}>
                  {t(picker === 'date' ? 'taskForm.selectDate' : 'taskForm.selectTime')}
                </Text>
                <Pressable onPress={() => setPicker(null)} style={styles.iosDoneButton}>
                  <Text style={styles.iosDoneText}>{t('common.done')}</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode={picker}
                value={pickerValue}
                display={picker === 'date' ? 'inline' : 'spinner'}
                themeVariant={theme}
                textColor={colors.text}
                accentColor={colors.primary}
                minimumDate={picker === 'date' ? new Date(2020, 0, 1) : undefined}
                onChange={handlePickerChange}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  iosPickerOverlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  iosPickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  iosPickerHeader: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 10,
  },
  iosPickerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  iosDoneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  iosDoneText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    backgroundColor: Platform.OS === 'web' ? colors.overlay : colors.background,
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.background,
    flex: Platform.OS === 'web' ? undefined : 1,
    width: Platform.OS === 'web' ? '92%' : '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    height: Platform.OS === 'web' ? '88%' : '100%',
    maxHeight: Platform.OS === 'web' ? 700 : undefined,
    borderRadius: Platform.OS === 'web' ? 24 : 0,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: colors.border,
  },
  keyboardWrap: { flex: 1, width: '100%' },
  scroll: { flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerTitle: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '800' },
  saveButton: { paddingHorizontal: 8, paddingVertical: 10 },
  saveText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 48 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 16 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: { minHeight: 96 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  pickerText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  webPickerBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  customDurationWrap: { marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  priorityRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
  },
  priorityChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  priorityChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 16 },
  pressed: { opacity: 0.7 },
});
