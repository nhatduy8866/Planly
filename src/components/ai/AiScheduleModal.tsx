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

export function AiScheduleModal({
  scheduler,
  targetDate,
  onOpenManualTaskModal,
}: AiScheduleModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

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
    submitRefinement,
    confirmSaveToCalendar,
  } = scheduler;

  if (!visible) return null;

  const isActionSheet = step === 'menu_action_sheet';

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        {/* Click outside to dismiss action sheet */}
        {isActionSheet ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
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
                  close();
                  onOpenManualTaskModal();
                }}
                onCancel={close}
              />
            )}

            {step === 'input_prompt' && (
              <AiInputView
                infoMessage={scheduler.infoMessage}
                onSubmit={submitPrompt}
                onClose={close}
              />
            )}

            {step === 'analyzing' && (
              <AiAnalyzingView
                currentStep={analyzingStep}
                onCancel={close}
              />
            )}

            {step === 'draft_preview' && (
              <AiDraftPreviewView
                drafts={draftTasks}
                targetDate={targetDate}
                onConfirm={() => void confirmSaveToCalendar()}
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
