import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { useAiScheduler } from '../../hooks/useAiScheduler';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { Task } from '../../types';
import type { AiDraftTask } from '../../types/ai';
import {
  TaskFormModal,
  type TaskFormValues,
} from '../TaskFormModal';
import { AiActionSheet } from './AiActionSheet';
import { AiAnalyzingView } from './AiAnalyzingView';
import { AiAutoSlottingView } from './AiAutoSlottingView';
import { AiConflictView } from './AiConflictView';
import { AiDraftPreviewView } from './AiDraftPreviewView';
import { AiInputView } from './AiInputView';
import { AiRefinementView } from './AiRefinementView';

interface AiScheduleModalProps {
  scheduler: ReturnType<typeof useAiScheduler>;
  targetDate: string;
  onOpenManualTaskModal: () => void;
}

function toEditableTask(draft: AiDraftTask, order: number): Task {
  return {
    id: draft.id,
    title: draft.title,
    description: draft.description ?? '',
    date: draft.date,
    startTime: draft.startTime || '09:00',
    reminderMinutes: draft.reminderMinutes,
    completed: false,
    order,
    priority: draft.priority,
    createdAt: '',
    updatedAt: '',
  };
}

export function AiScheduleModal({
  scheduler,
  targetDate,
  onOpenManualTaskModal,
}: AiScheduleModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  const {
    visible,
    step,
    setStep,
    analyzingStep,
    draftTasks,
    conflicts,
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
  } = scheduler;

  if (!visible) return null;

  const isActionSheet = step === 'menu_action_sheet';
  const editingDraftIndex = draftTasks.findIndex(
    (draft) => draft.id === editingDraftId,
  );
  const editingDraft = editingDraftIndex >= 0
    ? draftTasks[editingDraftIndex]
    : null;

  function handleUpdateDraft(values: TaskFormValues) {
    if (!editingDraft) return;
    updateDraftTask(editingDraft.id, {
      title: values.title,
      description: values.description,
      date: values.date,
      startTime: values.startTime,
      reminderMinutes: values.reminderMinutes,
      priority: values.priority,
    });
  }

  function handleClose() {
    setEditingDraftId(null);
    close();
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        {/* Click outside to dismiss action sheet */}
        {isActionSheet ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        ) : null}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.modalContainer,
            isActionSheet ? styles.actionSheetWrapper : styles.fullSheetWrapper,
            { paddingBottom: isActionSheet ? insets.bottom : 0 },
          ]}
        >
          <View
            style={[
              styles.card,
              isActionSheet ? styles.actionSheetCard : styles.fullSheetCard,
              !isActionSheet && {
                paddingTop: Platform.OS === 'web' ? 0 : Math.max(insets.top, 16),
              },
            ]}
          >
            {step === 'menu_action_sheet' && (
              <AiActionSheet
                onSelectAi={() => setStep('input_prompt')}
                onSelectManual={() => {
                  handleClose();
                  onOpenManualTaskModal();
                }}
                onCancel={handleClose}
              />
            )}

            {step === 'input_prompt' && (
              <AiInputView
                infoMessage={scheduler.infoMessage}
                onSubmit={submitPrompt}
                onClose={handleClose}
              />
            )}

            {step === 'analyzing' && (
              <AiAnalyzingView
                currentStep={analyzingStep}
                onCancel={handleClose}
              />
            )}

            {step === 'draft_preview' && (
              <AiDraftPreviewView
                drafts={draftTasks}
                targetDate={targetDate}
                onConfirm={() => void confirmSaveToCalendar()}
                onEditDraft={setEditingDraftId}
                onRefine={openRefinement}
                onBack={() => setStep('input_prompt')}
              />
            )}

            {step === 'refinement_chat' && (
              <AiRefinementView
                onSubmit={submitRefinement}
                onBack={() => setStep('draft_preview')}
              />
            )}

            {step === 'updated_preview' && (
              <AiDraftPreviewView
                isUpdated
                drafts={draftTasks}
                targetDate={targetDate}
                onConfirm={() => void confirmSaveToCalendar()}
                onEditDraft={setEditingDraftId}
                onRefine={openRefinement}
                onBack={openRefinement}
              />
            )}

            {step === 'auto_slotting' && (
              <AiAutoSlottingView
                drafts={draftTasks}
                infoMessage={scheduler.infoMessage}
                onAccept={handleAcceptAutoSlotting}
                onDecline={handleDeclineAutoSlotting}
                onBack={() => setStep('input_prompt')}
              />
            )}

            {step === 'conflict_resolution' && (
              <AiConflictView
                conflicts={conflicts}
                onSelectSlot={handleSelectConflictSlot}
                onApply={handleApplyConflictResolution}
                onBack={() => setStep('draft_preview')}
              />
            )}

          </View>
        </KeyboardAvoidingView>

        {editingDraft ? (
          <TaskFormModal
            key={editingDraft.id}
            defaultDate={editingDraft.date || targetDate}
            onClose={() => setEditingDraftId(null)}
            onSubmit={handleUpdateDraft}
            task={toEditableTask(editingDraft, editingDraftIndex)}
            visible
          />
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    alignSelf: 'center',
    maxWidth: 480,
    width: '100%',
  },
  actionSheetWrapper: {
    justifyContent: 'flex-end',
  },
  fullSheetWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  actionSheetCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  fullSheetCard: {
    borderRadius: Platform.OS === 'web' ? 24 : 0,
    flex: 1,
    maxHeight: Platform.OS === 'web' ? 760 : undefined,
  },
});
