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

import { colors } from '../theme/colors';
import type { ReminderMinutes, Task } from '../types';
import { fromDateKey, taskDateTime, toDateKey } from '../utils/date';
import { IconButton } from './IconButton';

export interface TaskFormValues {
  title: string;
  description: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  reminderMinutes: ReminderMinutes;
}

interface TaskFormModalProps {
  visible: boolean;
  task?: Task;
  defaultDate: string;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
}

const REMINDERS: { label: string; value: ReminderMinutes }[] = [
  { label: 'Không', value: null },
  { label: 'Đúng giờ', value: 0 },
  { label: '5 phút', value: 5 },
  { label: '15 phút', value: 15 },
  { label: '30 phút', value: 30 },
  { label: '1 giờ', value: 60 },
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
  const [reminder, setReminder] = useState<ReminderMinutes>(
    task?.reminderMinutes ?? null,
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
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
              <Pressable
                onPress={() => setPicker('date')}
                style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                <Text style={styles.pickerText}>{date.split('-').reverse().join('/')}</Text>
              </Pressable>
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Bắt đầu</Text>
              <Pressable
                onPress={() => setPicker('time')}
                style={({ pressed }) => [styles.pickerButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="schedule" size={19} color={colors.primary} />
                <Text style={styles.pickerText}>{startTime}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.label}>Thời lượng (phút)</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={setDuration}
            style={styles.input}
            value={duration}
          />

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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {picker ? (
            <DateTimePicker
              mode={picker}
              value={pickerValue}
              minimumDate={picker === 'date' ? new Date(2020, 0, 1) : undefined}
              onChange={handlePickerChange}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { backgroundColor: colors.background, flex: 1 },
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
  error: { color: colors.danger, fontSize: 13, marginTop: 16 },
  pressed: { opacity: 0.7 },
});
