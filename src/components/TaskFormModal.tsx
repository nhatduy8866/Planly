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
import { colors } from '../theme/colors';
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
  label: string;
  value: TaskPriority;
  icon?: keyof typeof MaterialIcons.glyphMap;
  color: string;
  activeBg: string;
}[] = [
  { label: 'Thường', value: 'none', color: colors.textMuted, activeBg: colors.surfaceMuted },
  { label: 'Thấp', value: 'low', icon: 'arrow-downward', color: colors.priorityLow, activeBg: colors.priorityLowSoft },
  { label: 'Vừa', value: 'medium', icon: 'drag-handle', color: colors.priorityMedium, activeBg: colors.priorityMediumSoft },
  { label: 'Cao', value: 'high', icon: 'error', color: colors.priorityHigh, activeBg: colors.priorityHighSoft },
];

const REMINDERS: { label: string; value: ReminderMinutes }[] = [
  { label: 'Không', value: null },
  { label: 'Đúng giờ', value: 0 },
  { label: '5 phút', value: 5 },
  { label: '15 phút', value: 15 },
  { label: '30 phút', value: 30 },
  { label: '1 giờ', value: 60 },
];

const DURATION_PRESETS: { label: string; value: number }[] = [
  { label: '15 phút', value: 15 },
  { label: '30 phút', value: 30 },
  { label: '45 phút', value: 45 },
  { label: '1 giờ', value: 60 },
  { label: '1.5 giờ', value: 90 },
  { label: '2 giờ', value: 120 },
];

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
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(task?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(task?.startTime ?? '09:00');
  const [duration, setDuration] = useState(String(task?.durationMinutes ?? 30));
  const [isCustomDuration, setIsCustomDuration] = useState(() => {
    const currentDuration = task?.durationMinutes ?? 30;
    return !DURATION_PRESETS.some((preset) => preset.value === currentDuration);
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
      setError('Hãy nhập tên công việc.');
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration < 5) {
      setError('Thời lượng phải từ 5 phút trở lên.');
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
      setError('Không thể lưu công việc. Vui lòng thử lại.');
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
                accessibilityLabel="Đóng"
                onPress={onClose}
                backgroundColor="transparent"
              />
              <Text style={styles.headerTitle}>
                {task ? 'Chỉnh sửa công việc' : 'Công việc mới'}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              >
                <Text style={styles.saveText}>{saving ? 'Đang lưu' : 'Lưu'}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
            <Text style={styles.label}>Tên công việc</Text>
            <TextInput
              autoFocus={!task}
              maxLength={120}
              onChangeText={setTitle}
              placeholder="Ví dụ: Chuẩn bị báo cáo"
              placeholderTextColor="#9AA19B"
              style={styles.input}
              value={title}
            />

            <Text style={styles.label}>Mô tả</Text>
            <TextInput
              maxLength={500}
              multiline
              onChangeText={setDescription}
              placeholder="Thêm chi tiết (không bắt buộc)"
              placeholderTextColor="#9AA19B"
              style={[styles.input, styles.textArea]}
              textAlignVertical="top"
              value={description}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Ngày</Text>
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
                <Text style={styles.label}>Bắt đầu</Text>
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

            <Text style={styles.label}>Thời lượng</Text>
            <View style={styles.chips}>
              {DURATION_PRESETS.map((item) => {
                const active = Number(duration) === item.value && !isCustomDuration;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      setDuration(String(item.value));
                      setIsCustomDuration(false);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.label}
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
                  Khác
                </Text>
              </Pressable>
            </View>

            {isCustomDuration ? (
              <View style={styles.customDurationWrap}>
                <TextInput
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={setDuration}
                  placeholder="Nhập số phút (ví dụ: 25)"
                  placeholderTextColor="#9AA19B"
                  style={[styles.input, { marginTop: 8 }]}
                  value={duration}
                />
              </View>
            ) : null}

            <Text style={styles.label}>Nhắc trước</Text>
            <View style={styles.chips}>
              {REMINDERS.map((item) => {
                const active = item.value === reminder;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => setReminder(item.value)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Mức độ ưu tiên</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map((item) => {
                const active = item.value === priority;
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
                        backgroundColor: item.activeBg,
                        borderColor: item.color,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    {item.icon ? (
                      <MaterialIcons
                        name={item.icon}
                        size={14}
                        color={active ? item.color : colors.textMuted}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.priorityChipText,
                        active && { color: item.color, fontWeight: '800' },
                      ]}
                    >
                      {item.label}
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
                  {picker === 'date' ? 'Chọn ngày' : 'Chọn giờ bắt đầu'}
                </Text>
                <Pressable onPress={() => setPicker(null)} style={styles.iosDoneButton}>
                  <Text style={styles.iosDoneText}>Xong</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode={picker}
                value={pickerValue}
                display={picker === 'date' ? 'inline' : 'spinner'}
                themeVariant="light"
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

const styles = StyleSheet.create({
  iosPickerOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    backgroundColor: Platform.OS === 'web' ? 'rgba(23, 32, 25, 0.45)' : colors.background,
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
