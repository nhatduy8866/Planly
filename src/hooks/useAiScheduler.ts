import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { usePreferences } from '../preferences/PreferencesContext';
import {
  usePlannerDispatch,
  usePlannerTasks,
} from '../store/PlannerContext';
import type { Task } from '../types';
import type { AiDraftTask, AiModalStep, AiSchedulingContext, ScheduleConflict } from '../types/ai';
import { defaultAiProvider } from '../services/ai/aiProvider';
import { AiScheduleClarificationError } from '../services/ai/scheduleClarification';
import { detectConflicts } from '../services/ai/conflictDetector';
import { autoSlotTasks } from '../services/ai/slottingEngine';
import {
  replaceTaskReminders,
  rollbackTaskReminders,
} from '../services/reminderTransaction';
import { formatLongDate, todayKey } from '../utils/date';

const SAVE_FEEDBACK_DURATION_MS = 6_000;
const TASK_HIGHLIGHT_DURATION_MS = 2_400;

export interface AiSaveFeedback {
  createdCount: number;
  tasks: Pick<Task, 'date' | 'id' | 'startTime' | 'title'>[];
  updatedCount: number;
}

interface AiUndoSnapshot {
  previousTasks: Task[];
  savedTasks: Task[];
}

export function useAiScheduler(
  targetDate: string,
  onNavigateDate?: (date: string) => void,
) {
  const tasks = usePlannerTasks();
  const dispatch = usePlannerDispatch();
  const { language, locale, t } = usePreferences();

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<AiModalStep>('menu_action_sheet');
  const [promptText, setPromptText] = useState('');
  const [analyzingStep, setAnalyzingStep] = useState<number>(1);
  const [draftTasks, setDraftTasks] = useState<AiDraftTask[]>([]);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [refinementInput, setRefinementInput] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<AiSaveFeedback | null>(null);
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [undoingSave, setUndoingSave] = useState(false);
  const undoSnapshotRef = useRef<AiUndoSnapshot | null>(null);
  const undoingSaveRef = useRef(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const context: AiSchedulingContext = useMemo(() => {
    const realToday = todayKey();
    return {
      realToday,
      realTodayDayName: formatLongDate(realToday, locale),
      targetDate,
      currentDayName: formatLongDate(targetDate, locale),
      existingTasks: tasks.filter((t) => t.date === targetDate),
      allTasks: tasks,
    };
  }, [locale, targetDate, tasks]);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = undefined;
    }
  }, []);

  const dismissSaveFeedback = useCallback(() => {
    clearFeedbackTimer();
    undoSnapshotRef.current = null;
    undoingSaveRef.current = false;
    setSaveFeedback(null);
    setUndoingSave(false);
  }, [clearFeedbackTimer]);

  const highlightTasks = useCallback((taskIds: string[]) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedTaskIds(new Set(taskIds));
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTaskIds(new Set());
      highlightTimeoutRef.current = undefined;
    }, TASK_HIGHLIGHT_DURATION_MS);
  }, []);

  useEffect(() => () => {
    clearFeedbackTimer();
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  }, [clearFeedbackTimer]);

  const openActionSheet = useCallback(() => {
    dismissSaveFeedback();
    setInfoMessage(null);
    setStep('menu_action_sheet');
    setVisible(true);
  }, [dismissSaveFeedback]);

  const openDirectPrompt = useCallback(() => {
    dismissSaveFeedback();
    setInfoMessage(null);
    setStep('input_prompt');
    setVisible(true);
  }, [dismissSaveFeedback]);

  const close = useCallback(() => {
    setVisible(false);
    // Reset state sau khi đóng
    setTimeout(() => {
      setStep('menu_action_sheet');
      setPromptText('');
      setDraftTasks([]);
      setConflicts([]);
      setAnalyzingStep(1);
      setInfoMessage(null);
    }, 200);
  }, []);

  // Bắt đầu phân tích yêu cầu từ người dùng (Màn 3 -> 4)
  const submitPrompt = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      void Haptics.selectionAsync();

      setInfoMessage(null);
      setStep('analyzing');
      setAnalyzingStep(1);

      // Hiệu ứng checklist động 4 bước
      const timer1 = setTimeout(() => setAnalyzingStep(2), 350);
      const timer2 = setTimeout(() => setAnalyzingStep(3), 700);
      const timer3 = setTimeout(() => setAnalyzingStep(4), 1050);

      try {
        const parsedDrafts = await defaultAiProvider.parseScheduleRequest(text, context);

        // Nếu không có công việc nào (ví dụ: ngày trống mà yêu cầu sắp xếp lại, hoặc không nhận diện được việc)
        if (!parsedDrafts || parsedDrafts.length === 0) {
          setInfoMessage(t('ai.noTasksToReorder'));
          setStep('input_prompt');
          return;
        }

        setInfoMessage(null);

        // Kiểm tra xem có task nào thiếu giờ không (Màn 8)
        const hasUnscheduled = parsedDrafts.some((d) => !d.startTime);
        if (hasUnscheduled) {
          setDraftTasks(parsedDrafts);
          setStep('auto_slotting');
          return;
        }

        // Kiểm tra xung đột trùng giờ (Màn 9)
        const detected = detectConflicts(parsedDrafts, tasks);
        if (detected.length > 0) {
          setDraftTasks(parsedDrafts);
          setConflicts(detected);
          setStep('conflict_resolution');
          return;
        }

        // Nếu tất cả chuẩn chỉnh -> Xem trước kế hoạch (Màn 5)
        setDraftTasks(parsedDrafts);
        setStep('draft_preview');
      } catch (err) {
        if (err instanceof AiScheduleClarificationError) {
          setInfoMessage(
            t('ai.clarifyUnaccentedTime', { hour: err.hour }),
          );
        } else {
          console.error('Lỗi phân tích AI:', err);
          setInfoMessage(t('ai.parseFailed'));
        }
        setStep('input_prompt');
      } finally {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      }
    },
    [context, tasks, t],
  );

  // Người dùng đồng ý tự động sắp xếp giờ cho các việc chưa có giờ (Màn 8 -> 9 hoặc 5)
  const handleAcceptAutoSlotting = useCallback(() => {
    void Haptics.selectionAsync();
    const slotted = autoSlotTasks(draftTasks, context.existingTasks, context.targetDate);
    const unscheduledCount = slotted.filter((draft) => !draft.startTime).length;

    setDraftTasks(slotted);
    if (unscheduledCount > 0) {
      setInfoMessage(t('ai.noSlots', { count: unscheduledCount }));
      setStep('auto_slotting');
      return;
    }

    const detected = detectConflicts(slotted, tasks);

    setInfoMessage(null);
    if (detected.length > 0) {
      setConflicts(detected);
      setStep('conflict_resolution');
    } else {
      setStep('draft_preview');
    }
  }, [draftTasks, context, tasks, t]);

  // Người dùng từ chối tự xếp giờ, giữ nguyên (Màn 8 -> 5)
  const handleDeclineAutoSlotting = useCallback(() => {
    void Haptics.selectionAsync();
    setStep('draft_preview');
  }, []);

  // Chọn giờ bắt đầu thay thế trong màn hình Xử lý trùng lịch (Màn 9)
  const handleSelectConflictSlot = useCallback(
    (conflictIndex: number, slotId: string) => {
      setConflicts((prev) =>
        prev.map((c, idx) =>
          idx === conflictIndex ? { ...c, selectedSlotId: slotId } : c,
        ),
      );
    },
    [],
  );

  // Áp dụng giải quyết xung đột (Màn 9 -> 5)
  const handleApplyConflictResolution = useCallback(() => {
    void Haptics.selectionAsync();
    const updatedDrafts = draftTasks.map((draft) => {
      const conflict = conflicts.find((c) => c.draftTaskId === draft.id);
      if (!conflict) return draft;

      const chosenSlot = conflict.suggestedSlots.find(
        (s) => s.id === conflict.selectedSlotId,
      );
      if (chosenSlot) {
        return {
          ...draft,
          startTime: chosenSlot.startTime,
          source: 'conflict_resolved' as const,
          changeStatus: 'updated' as const,
        };
      }
      return draft;
    });

    setDraftTasks(updatedDrafts);
    const remainingConflicts = detectConflicts(updatedDrafts, tasks);

    if (remainingConflicts.length > 0) {
      setConflicts(remainingConflicts);
      setStep('conflict_resolution');
    } else {
      setConflicts([]);
      setStep('draft_preview');
    }
  }, [draftTasks, conflicts, tasks]);

  // Mở màn hình tinh chỉnh bằng AI (Màn 5 -> 6)
  const openRefinement = useCallback(() => {
    setRefinementInput('');
    setStep('refinement_chat');
  }, []);

  const updateDraftTask = useCallback((
    draftId: string,
    values: Pick<
      AiDraftTask,
      'title' | 'description' | 'date' | 'startTime' | 'reminderMinutes' | 'priority'
    >,
  ) => {
    setDraftTasks((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              ...values,
              changeStatus: draft.changeStatus === 'added' ? 'added' : 'updated',
            }
          : draft,
      ),
    );
    setConflicts([]);
  }, []);

  // Gửi lệnh chỉnh sửa bằng AI (Màn 6 -> 4 -> 7)
  const submitRefinement = useCallback(
    async (instruction: string) => {
      if (!instruction.trim()) return;
      void Haptics.selectionAsync();

      setStep('analyzing');
      setAnalyzingStep(1);

      const timer1 = setTimeout(() => setAnalyzingStep(2), 300);
      const timer2 = setTimeout(() => setAnalyzingStep(3), 600);
      const timer3 = setTimeout(() => setAnalyzingStep(4), 900);

      try {
        const refined = await defaultAiProvider.refineSchedule(
          draftTasks,
          instruction,
          context,
        );

        setDraftTasks(refined);

        const unscheduledCount = refined.filter(
          (draft) => !draft.startTime,
        ).length;
        if (unscheduledCount > 0) {
          setInfoMessage(t('ai.unscheduledAfterRefinement', { count: unscheduledCount }));
          setStep('auto_slotting');
          return;
        }

        const detected = detectConflicts(refined, tasks);
        if (detected.length > 0) {
          setConflicts(detected);
          setInfoMessage(null);
          setStep('conflict_resolution');
          return;
        }

        setConflicts([]);
        setInfoMessage(null);
        setStep('updated_preview'); // Màn 7: Kế hoạch đã cập nhật
      } catch (err) {
        console.error('Lỗi tinh chỉnh AI:', err);
        setStep('refinement_chat');
      } finally {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      }
    },
    [draftTasks, context, tasks, t],
  );

  // Xác nhận lưu vào lịch rồi đóng modal và phản hồi trên màn hình hiện tại.
  const confirmSaveToCalendar = useCallback(async () => {
    if (!draftTasks.length) return;

    const unscheduledCount = draftTasks.filter((draft) => !draft.startTime).length;
    if (unscheduledCount > 0) {
      setInfoMessage(t('ai.unscheduledSave', { count: unscheduledCount }));
      setStep('auto_slotting');
      return;
    }

    const detected = detectConflicts(draftTasks, tasks);
    if (detected.length > 0) {
      setConflicts(detected);
      setInfoMessage(null);
      setStep('conflict_resolution');
      return;
    }

    const nowIso = new Date().toISOString();
    const existingMap = new Map(tasks.map((t) => [t.id, t]));

    const tasksToSave: Task[] = draftTasks.map((draft, idx) => {
      const existing = existingMap.get(draft.id);
      if (existing) {
        // Cập nhật lại task hiện có, giữ nguyên trạng thái hoàn thành, ghi chú và ngày tạo
        return {
          ...existing,
          title: draft.title,
          description: draft.description ?? existing.description,
          date: draft.date,
          startTime: draft.startTime || existing.startTime,
          reminderMinutes: draft.reminderMinutes,
          priority: draft.priority,
          order: idx,
          updatedAt: nowIso,
        };
      }
      return {
        id: draft.id.startsWith('task-')
          ? draft.id
          : `task-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        title: draft.title,
        description: draft.description ?? '',
        date: draft.date,
        startTime: draft.startTime,
        reminderMinutes: draft.reminderMinutes,
        completed: false,
        order: idx,
        priority: draft.priority,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    // Đồng bộ reminder trước khi lưu để notificationId trong state luôn là ID mới.
    const tasksWithReminders = await replaceTaskReminders(
      tasksToSave,
      tasks,
      { language },
    );
    dispatch({ type: 'create_batch_tasks', payload: tasksWithReminders });

    const previousTasks = tasksToSave
      .map((task) => existingMap.get(task.id))
      .filter((task): task is Task => Boolean(task));
    undoSnapshotRef.current = { previousTasks, savedTasks: tasksWithReminders };
    const feedback: AiSaveFeedback = {
      createdCount: tasksWithReminders.length - previousTasks.length,
      tasks: tasksWithReminders.map(({ date, id, startTime, title }) => ({
        date,
        id,
        startTime,
        title,
      })),
      updatedCount: previousTasks.length,
    };
    clearFeedbackTimer();
    setSaveFeedback(feedback);
    feedbackTimeoutRef.current = setTimeout(() => {
      undoSnapshotRef.current = null;
      setSaveFeedback(null);
      feedbackTimeoutRef.current = undefined;
    }, SAVE_FEEDBACK_DURATION_MS);
    highlightTasks(tasksWithReminders.map((task) => task.id));

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  }, [
    clearFeedbackTimer,
    close,
    draftTasks,
    dispatch,
    highlightTasks,
    language,
    tasks,
    t,
  ]);

  const undoLastSave = useCallback(async () => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot || undoingSaveRef.current) return;

    undoingSaveRef.current = true;
    clearFeedbackTimer();
    setUndoingSave(true);
    const previousTasks = await rollbackTaskReminders(
      snapshot.savedTasks,
      snapshot.previousTasks,
      { language },
    );
    dispatch({
      type: 'rollback_task_batch',
      payload: {
        savedIds: snapshot.savedTasks.map((task) => task.id),
        previousTasks,
      },
    });
    undoSnapshotRef.current = null;
    undoingSaveRef.current = false;
    setSaveFeedback(null);
    setUndoingSave(false);
    setHighlightedTaskIds(new Set());
  }, [clearFeedbackTimer, dispatch, language]);

  const viewSavedTasks = useCallback((date?: string) => {
    const feedback = saveFeedback;
    const createdDate = date ?? feedback?.tasks[0]?.date;
    if (createdDate && onNavigateDate) {
      onNavigateDate(createdDate);
      if (feedback) highlightTasks(feedback.tasks.map((task) => task.id));
    }
    dismissSaveFeedback();
  }, [dismissSaveFeedback, highlightTasks, onNavigateDate, saveFeedback]);

  return {
    visible,
    step,
    setStep,
    promptText,
    setPromptText,
    analyzingStep,
    draftTasks,
    conflicts,
    refinementInput,
    setRefinementInput,
    infoMessage,
    setInfoMessage,
    openActionSheet,
    openDirectPrompt,
    close,
    submitPrompt,
    handleAcceptAutoSlotting,
    handleDeclineAutoSlotting,
    handleSelectConflictSlot,
    handleApplyConflictResolution,
    openRefinement,
    updateDraftTask,
    submitRefinement,
    confirmSaveToCalendar,
    saveFeedback,
    highlightedTaskIds,
    undoingSave,
    dismissSaveFeedback,
    undoLastSave,
    viewSavedTasks,
  };
}
