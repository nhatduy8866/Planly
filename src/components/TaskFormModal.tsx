import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
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

import { usePreferences } from '../preferences/PreferencesContext';
import { CARD_COLOR_PRESETS, type ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ReminderMinutes, Task, TaskPriority } from '../types';
import {
  addDays,
  fromDateKey,
  getWeekdayShort,
  taskDateTime,
  toDateKey,
} from '../utils/date';
import {
  addCalendarMonths,
  buildTaskBatchDates,
  getTaskBatchRangeIssue,
} from '../utils/taskBatch';
import { TaskTimeConflictError } from '../utils/taskConflicts';
import { IconButton } from './IconButton';

export interface TaskFormValues {
  title: string;
  description: string;
  date: string;
  startTime: string;
  reminderMinutes: ReminderMinutes;
  color?: string;
  priority: TaskPriority;
  batchDates?: string[];
  applyToBatch?: boolean;
}

interface TaskFormModalProps {
  visible: boolean;
  task?: Task;
  defaultDate: string;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
}

type PickerTarget = 'date' | 'time' | 'batchEnd' | null;
type BatchMode = 'weekly' | 'monthly';

export { CARD_COLOR_PRESETS };

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

const PRIORITY_OPTIONS: {
  value: TaskPriority;
  icon?: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { value: 'none' },
  { value: 'low', icon: 'arrow-downward' },
  { value: 'medium', icon: 'drag-handle' },
  { value: 'high', icon: 'error' },
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
  const { colors, locale, t, theme } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const initialDate = task?.date ?? defaultDate;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(task?.startTime ?? '09:00');
  const [color, setColor] = useState<string | undefined>(task?.color);
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? 'none',
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [applyToBatch, setApplyToBatch] = useState(false);
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [batchMode, setBatchMode] = useState<BatchMode>('weekly');
  const [batchEndDate, setBatchEndDate] = useState(
    addCalendarMonths(initialDate, 3),
  );
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([
    fromDateKey(initialDate).getDay(),
  ]);
  const [selectedMonthDays, setSelectedMonthDays] = useState<number[]>([
    fromDateKey(initialDate).getDate(),
  ]);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const weekdayOptions = useMemo(() => {
    const monday = new Date(2026, 8, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const weekdayDate = addDays(monday, index);
      return {
        label: getWeekdayShort(weekdayDate, locale),
        value: weekdayDate.getDay(),
      };
    });
  }, [locale]);

  const batchRangeIssue = batchEnabled
    ? getTaskBatchRangeIssue(date, batchEndDate)
    : null;
  const batchSelectionMissing =
    batchEnabled &&
    (batchMode === 'weekly'
      ? selectedWeekdays.length === 0
      : selectedMonthDays.length === 0);
  const batchDates = useMemo(() => {
    if (!batchEnabled || batchRangeIssue) return [];

    return buildTaskBatchDates(
      date,
      batchEndDate,
      batchMode === 'weekly'
        ? { mode: 'weekly', weekdays: selectedWeekdays }
        : { mode: 'monthly', monthDays: selectedMonthDays },
    );
  }, [
    batchEnabled,
    batchEndDate,
    batchMode,
    batchRangeIssue,
    date,
    selectedMonthDays,
    selectedWeekdays,
  ]);
  const batchValidationKey = !batchEnabled
    ? null
    : batchSelectionMissing
      ? 'taskForm.batchSelectionRequired'
      : batchRangeIssue === 'end_before_start'
        ? 'taskForm.batchEndInvalid'
        : batchRangeIssue === 'range_too_long'
          ? 'taskForm.batchRangeTooLong'
          : !batchDates.length
            ? 'taskForm.batchNoDates'
            : null;

  function updateDate(nextDate: string) {
    setDate(nextDate);
    if (batchEndDate < nextDate) {
      setBatchEndDate(addCalendarMonths(nextDate, 3));
    }
  }

  function handlePickerValueChange(
    _event: DateTimePickerChangeEvent,
    selected: Date,
  ) {
    const target = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (target === 'date') updateDate(toDateKey(selected));
    if (target === 'time') setStartTime(formatTime(selected));
    if (target === 'batchEnd') setBatchEndDate(toDateKey(selected));
  }

  function toggleBatch() {
    const nextEnabled = !batchEnabled;
    if (nextEnabled) {
      const currentDate = fromDateKey(date);
      setSelectedWeekdays([currentDate.getDay()]);
      setSelectedMonthDays([currentDate.getDate()]);
      setBatchEndDate(addCalendarMonths(date, 3));
    }
    setBatchEnabled(nextEnabled);
    void Haptics.selectionAsync();
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('taskForm.titleRequired'));
      return;
    }

    if (
      !task &&
      batchEnabled &&
      batchValidationKey
    ) {
      setAdvancedOpen(true);
      setError(
        t(batchValidationKey),
      );
      return;
    }

    setSaving(true);
    setError('');
    let saved = false;
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        date,
        startTime,
        reminderMinutes: 0,
        color,
        priority,
        batchDates: !task && batchEnabled ? batchDates : undefined,
        applyToBatch: task?.batchId ? applyToBatch : undefined,
      });
      saved = true;
    } catch (submitError) {
      if (submitError instanceof TaskTimeConflictError) {
        const { conflict } = submitError;
        setError(
          t('taskForm.timeConflict', {
            date: conflict.task.date.split('-').reverse().join('/'),
            time: conflict.task.startTime,
            title: conflict.conflictingTask.title,
          }),
        );
      } else {
        setError(t('taskForm.saveError'));
      }
    } finally {
      setSaving(false);
    }

    if (saved) {
      setPicker(null);
      onClose();
    }
  }

  const pickerValue =
    picker === 'date'
      ? fromDateKey(date)
      : picker === 'batchEnd'
        ? fromDateKey(batchEndDate)
        : taskDateTime(date, startTime);
  const pickerMode = picker === 'time' ? 'time' : 'date';
  const pickerMinimumDate =
    picker === 'batchEnd' ? fromDateKey(date) : new Date(2020, 0, 1);

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
            <View
              style={[
                styles.header,
                {
                  paddingTop:
                    Platform.OS === 'web' ? 16 : Math.max(insets.top, 16),
                },
              ]}
            >
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
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                ]}
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
              <Text style={styles.firstLabel}>{t('taskForm.name')}</Text>
              <TextInput
                autoFocus={!task}
                maxLength={120}
                onChangeText={setTitle}
                placeholder={t('taskForm.namePlaceholder')}
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                value={title}
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Text style={styles.label}>{t('taskForm.date')}</Text>
                  {Platform.OS === 'web' ? (
                    <View style={styles.webPickerBox}>
                      <MaterialIcons
                        name="calendar-today"
                        size={18}
                        color={colors.primary}
                      />
                      <input
                        type="date"
                        value={date}
                        onChange={(event: any) => updateDate(event.target.value)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: colors.text,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 14,
                          fontWeight: '600',
                          outline: 'none',
                          width: '100%',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setPicker('date')}
                      style={({ pressed }) => [
                        styles.pickerButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialIcons
                        name="calendar-today"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.pickerText}>
                        {date.split('-').reverse().join('/')}
                      </Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.half}>
                  <Text style={styles.label}>{t('taskForm.start')}</Text>
                  {Platform.OS === 'web' ? (
                    <View style={styles.webPickerBox}>
                      <MaterialIcons
                        name="schedule"
                        size={19}
                        color={colors.primary}
                      />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(event: any) =>
                          setStartTime(event.target.value)
                        }
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: colors.text,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 14,
                          fontWeight: '600',
                          outline: 'none',
                          width: '100%',
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setPicker('time')}
                      style={({ pressed }) => [
                        styles.pickerButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialIcons
                        name="schedule"
                        size={19}
                        color={colors.primary}
                      />
                      <Text style={styles.pickerText}>{startTime}</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: advancedOpen }}
                onPress={() => setAdvancedOpen((current) => !current)}
                style={({ pressed }) => [
                  styles.advancedToggle,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.advancedTitleRow}>
                  <MaterialIcons
                    name="tune"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.advancedTitle}>
                    {t('taskForm.advanced')}
                  </Text>
                </View>
                <MaterialIcons
                  name={advancedOpen ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={colors.textMuted}
                />
              </Pressable>

              {advancedOpen ? (
                <View style={styles.advancedPanel}>
                  <Text style={styles.panelFirstLabel}>
                    {t('taskForm.description')}
                  </Text>
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

                  <Text style={styles.label}>{t('taskForm.priority')}</Text>
                  <View style={styles.priorityRow}>
                    {PRIORITY_OPTIONS.map((item) => {
                      const active = item.value === priority;
                      const color =
                        item.value === 'high'
                          ? colors.priorityHigh
                          : item.value === 'medium'
                            ? colors.priorityMedium
                            : item.value === 'low'
                              ? colors.priorityLow
                              : colors.textMuted;
                      const activeBackground =
                        item.value === 'high'
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
                              backgroundColor: activeBackground,
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

                  <Text style={styles.label}>{t('taskForm.cardColor')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.colorPalette}
                  >
                    <Pressable
                      onPress={() => {
                        setColor(undefined);
                        void Haptics.selectionAsync();
                      }}
                      style={({ pressed }) => [
                        styles.colorChip,
                        !color && styles.colorChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.randomColorCircle}>
                        <MaterialIcons
                          name="shuffle"
                          size={15}
                          color={!color ? colors.primaryDark : colors.textMuted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.colorChipText,
                          !color && styles.colorChipTextSelected,
                        ]}
                      >
                        {t('taskForm.colorRandom')}
                      </Text>
                    </Pressable>
                    {CARD_COLOR_PRESETS.map((presetColor) => {
                      const isSelected = color === presetColor;
                      return (
                        <Pressable
                          key={presetColor}
                          accessibilityLabel={presetColor}
                          onPress={() => {
                            setColor(presetColor);
                            void Haptics.selectionAsync();
                          }}
                          style={({ pressed }) => [
                            styles.colorCircle,
                            { backgroundColor: presetColor },
                            isSelected && styles.colorCircleSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          {isSelected ? (
                            <MaterialIcons
                              name="check"
                              size={16}
                              color="#FFFFFF"
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {task?.batchId ? (
                    <View style={styles.batchSection}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: applyToBatch }}
                        onPress={() => {
                          setApplyToBatch((current) => !current);
                          void Haptics.selectionAsync();
                        }}
                        style={({ pressed }) => [
                          styles.batchToggle,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.batchTitleRow}>
                          <MaterialIcons
                            name="repeat"
                            size={20}
                            color={colors.primary}
                          />
                          <View style={styles.batchTitleWrap}>
                            <Text style={styles.batchTitle}>
                              {t('taskForm.batchEdit')}
                            </Text>
                            <Text style={styles.batchDescription}>
                              {t('taskForm.batchEditDescription')}
                            </Text>
                          </View>
                        </View>
                        <MaterialIcons
                          name={
                            applyToBatch
                              ? 'check-box'
                              : 'check-box-outline-blank'
                          }
                          size={24}
                          color={
                            applyToBatch ? colors.primary : colors.textMuted
                          }
                        />
                      </Pressable>
                    </View>
                  ) : !task ? (
                    <View style={styles.batchSection}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: batchEnabled }}
                        onPress={toggleBatch}
                        style={({ pressed }) => [
                          styles.batchToggle,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.batchTitleRow}>
                          <MaterialIcons
                            name="repeat"
                            size={20}
                            color={colors.primary}
                          />
                          <View style={styles.batchTitleWrap}>
                            <Text style={styles.batchTitle}>
                              {t('taskForm.batchCreate')}
                            </Text>
                            <Text style={styles.batchDescription}>
                              {t('taskForm.batchDescription')}
                            </Text>
                          </View>
                        </View>
                        <MaterialIcons
                          name={
                            batchEnabled
                              ? 'check-box'
                              : 'check-box-outline-blank'
                          }
                          size={24}
                          color={
                            batchEnabled ? colors.primary : colors.textMuted
                          }
                        />
                      </Pressable>

                      {batchEnabled ? (
                        <View style={styles.batchOptions}>
                          <Text style={styles.batchLabel}>
                            {t('taskForm.batchPattern')}
                          </Text>
                          <View style={styles.segmentedControl}>
                            {(['weekly', 'monthly'] as const).map((mode) => {
                              const active = batchMode === mode;
                              return (
                                <Pressable
                                  key={mode}
                                  onPress={() => {
                                    setBatchMode(mode);
                                    void Haptics.selectionAsync();
                                  }}
                                  style={[
                                    styles.segment,
                                    active && styles.segmentActive,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.segmentText,
                                      active && styles.segmentTextActive,
                                    ]}
                                  >
                                    {t(
                                      mode === 'weekly'
                                        ? 'taskForm.batchWeekly'
                                        : 'taskForm.batchMonthly',
                                    )}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          {batchMode === 'weekly' ? (
                            <>
                              <Text style={styles.batchLabel}>
                                {t('taskForm.batchWeekdays')}
                              </Text>
                              <View style={styles.weekdayRow}>
                                {weekdayOptions.map((item) => {
                                  const active = selectedWeekdays.includes(
                                    item.value,
                                  );
                                  return (
                                    <Pressable
                                      key={item.value}
                                      onPress={() =>
                                        setSelectedWeekdays((current) =>
                                          current.includes(item.value)
                                            ? current.filter(
                                                (value) => value !== item.value,
                                              )
                                            : [...current, item.value],
                                        )
                                      }
                                      style={[
                                        styles.weekdayChip,
                                        active && styles.chipActive,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.weekdayText,
                                          active && styles.chipTextActive,
                                        ]}
                                      >
                                        {item.label}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </>
                          ) : (
                            <>
                              <Text style={styles.batchLabel}>
                                {t('taskForm.batchMonthDays')}
                              </Text>
                              <View style={styles.monthDayGrid}>
                                {MONTH_DAYS.map((day) => {
                                  const active = selectedMonthDays.includes(day);
                                  return (
                                    <Pressable
                                      key={day}
                                      onPress={() =>
                                        setSelectedMonthDays((current) =>
                                          current.includes(day)
                                            ? current.filter(
                                                (value) => value !== day,
                                              )
                                            : [...current, day],
                                        )
                                      }
                                      style={[
                                        styles.monthDayChip,
                                        active && styles.chipActive,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.monthDayText,
                                          active && styles.chipTextActive,
                                        ]}
                                      >
                                        {day}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </>
                          )}

                          <Text style={styles.batchLabel}>
                            {t('taskForm.batchEndDate')}
                          </Text>
                          {Platform.OS === 'web' ? (
                            <View style={styles.webPickerBox}>
                              <MaterialIcons
                                name="date-range"
                                size={18}
                                color={colors.primary}
                              />
                              <input
                                type="date"
                                min={date}
                                value={batchEndDate}
                                onChange={(event: any) =>
                                  setBatchEndDate(event.target.value)
                                }
                                style={{
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  color: colors.text,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  fontSize: 14,
                                  fontWeight: '600',
                                  outline: 'none',
                                  width: '100%',
                                }}
                              />
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => setPicker('batchEnd')}
                              style={({ pressed }) => [
                                styles.pickerButton,
                                pressed && styles.pressed,
                              ]}
                            >
                              <MaterialIcons
                                name="date-range"
                                size={18}
                                color={colors.primary}
                              />
                              <Text style={styles.pickerText}>
                                {batchEndDate.split('-').reverse().join('/')}
                              </Text>
                            </Pressable>
                          )}

                          {batchValidationKey ? (
                            <Text style={styles.inlineError}>
                              {t(batchValidationKey)}
                            </Text>
                          ) : (
                            <View style={styles.batchSummary}>
                              <MaterialIcons
                                name="event-available"
                                size={17}
                                color={colors.primary}
                              />
                              <Text style={styles.batchSummaryText}>
                                {t('taskForm.batchSummary', {
                                  count: batchDates.length,
                                })}
                              </Text>
                            </View>
                          )}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {Platform.OS === 'android' && picker ? (
                <DateTimePicker
                  mode={pickerMode}
                  value={pickerValue}
                  minimumDate={pickerMinimumDate}
                  onDismiss={() => setPicker(null)}
                  onValueChange={handlePickerValueChange}
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
                  {t(
                    picker === 'date'
                      ? 'taskForm.selectDate'
                      : picker === 'batchEnd'
                        ? 'taskForm.batchEndDate'
                        : 'taskForm.selectTime',
                  )}
                </Text>
                <Pressable
                  onPress={() => setPicker(null)}
                  style={styles.iosDoneButton}
                >
                  <Text style={styles.iosDoneText}>{t('common.done')}</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode={pickerMode}
                value={pickerValue}
                display={pickerMode === 'date' ? 'inline' : 'spinner'}
                themeVariant={theme}
                textColor={colors.text}
                accentColor={colors.primary}
                minimumDate={pickerMinimumDate}
                onDismiss={() => setPicker(null)}
                onValueChange={handlePickerValueChange}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    iosDoneButton: { paddingHorizontal: 12, paddingVertical: 6 },
    iosDoneText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '700',
    },
    modalBackdrop: {
      alignItems: 'center',
      backgroundColor:
        Platform.OS === 'web' ? colors.overlay : colors.background,
      flex: 1,
      height: '100%',
      justifyContent: 'center',
      width: '100%',
    },
    modalCard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: Platform.OS === 'web' ? 24 : 0,
      borderWidth: Platform.OS === 'web' ? 1 : 0,
      flex: Platform.OS === 'web' ? undefined : 1,
      height: Platform.OS === 'web' ? '88%' : '100%',
      maxHeight: Platform.OS === 'web' ? 760 : undefined,
      maxWidth: Platform.OS === 'web' ? 500 : undefined,
      overflow: 'hidden',
      width: Platform.OS === 'web' ? '92%' : '100%',
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
    headerTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
    },
    saveButton: { paddingHorizontal: 10, paddingVertical: 10 },
    saveText: { color: colors.primary, fontSize: 18, fontWeight: '800' },
    content: { padding: 20, paddingBottom: 48 },
    firstLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 7,
    },
    panelFirstLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 7,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 7,
      marginTop: 16,
    },
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
    textArea: { minHeight: 88 },
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
    advancedToggle: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    advancedTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 9,
    },
    advancedTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    advancedPanel: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      borderColor: colors.border,
      borderTopWidth: 0,
      borderWidth: 1,
      marginTop: -2,
      padding: 14,
      paddingTop: 16,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTextActive: { color: colors.white },
    priorityRow: { flexDirection: 'row', gap: 7, marginTop: 4 },
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
    colorPalette: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
      paddingVertical: 4,
    },
    colorChip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    colorChipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    colorChipText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    colorChipTextSelected: {
      color: colors.primaryDark,
      fontWeight: '800',
    },
    randomColorCircle: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      height: 24,
      justifyContent: 'center',
      width: 24,
    },
    colorCircle: {
      alignItems: 'center',
      borderColor: 'transparent',
      borderRadius: 16,
      borderWidth: 2,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    colorCircleSelected: {
      borderColor: colors.text,
      transform: [{ scale: 1.1 }],
    },
    batchSection: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      marginTop: 20,
      paddingTop: 16,
    },
    batchToggle: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    batchTitleRow: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: 9,
    },
    batchTitleWrap: { flex: 1 },
    batchTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    batchDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    batchOptions: { marginTop: 16 },
    batchLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 7,
      marginTop: 13,
    },
    segmentedControl: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 11,
      flexDirection: 'row',
      padding: 3,
    },
    segment: {
      alignItems: 'center',
      borderRadius: 9,
      flex: 1,
      paddingHorizontal: 6,
      paddingVertical: 9,
    },
    segmentActive: { backgroundColor: colors.surface },
    segmentText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    segmentTextActive: { color: colors.primaryDark },
    weekdayRow: { flexDirection: 'row', gap: 5 },
    weekdayChip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 36,
    },
    weekdayText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    monthDayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    monthDayChip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    monthDayText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    batchSummary: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 7,
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    batchSummaryText: {
      color: colors.primaryDark,
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
    },
    inlineError: { color: colors.danger, fontSize: 12, marginTop: 9 },
    error: { color: colors.danger, fontSize: 13, marginTop: 16 },
    pressed: { opacity: 0.7 },
  });
