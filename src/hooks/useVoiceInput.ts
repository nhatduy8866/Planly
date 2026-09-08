import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { usePreferences } from '../preferences/PreferencesContext';
import {
  cancelAudioRecording,
  startAudioRecording,
  stopAudioRecording,
} from '../services/speech/audioRecorder';
import { transcribeAudioWithGemini } from '../services/speech/geminiSpeechService';

const MAX_RECORDING_DURATION_SECONDS = 30;
const MIN_RECORDING_DURATION_MS = 600;

interface UseVoiceInputOptions {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceInput({ onTranscript, onError }: UseVoiceInputOptions) {
  const { t } = usePreferences();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      void cancelAudioRecording();
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(async () => {
    clearTimer();
    setIsRecording(false);

    try {
      const recordingResult = await stopAudioRecording();
      if (!recordingResult) {
        return;
      }

      if (recordingResult.durationMs < MIN_RECORDING_DURATION_MS) {
        const shortMsg = t('ai.voiceTooShort');
        if (isMountedRef.current) {
          setErrorMessage(shortMsg);
        }
        onError?.(shortMsg);
        return;
      }

      if (isMountedRef.current) {
        setIsTranscribing(true);
        setErrorMessage(null);
      }

      try {
        const transcript = await transcribeAudioWithGemini(
          recordingResult.uri,
          recordingResult.mimeType,
        );

        if (isMountedRef.current && transcript) {
          onTranscript(transcript);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        console.warn('Lỗi nhận diện giọng nói qua Gemini:', err);
        const errorMsg = t('ai.voiceError');
        if (isMountedRef.current) {
          setErrorMessage(errorMsg);
        }
        onError?.(errorMsg);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        if (isMountedRef.current) {
          setIsTranscribing(false);
        }
      }
    } catch (err) {
      console.warn('Lỗi xử lý file ghi âm:', err);
      if (isMountedRef.current) {
        setErrorMessage(t('ai.voiceError'));
      }
    }
  }, [clearTimer, onError, onTranscript, t]);

  const startListening = useCallback(async () => {
    setErrorMessage(null);
    void Haptics.selectionAsync();

    const started = await startAudioRecording();
    if (!started) {
      const permMsg = t('ai.voicePermissionDenied');
      setErrorMessage(permMsg);
      onError?.(permMsg);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsRecording(true);
    setDurationSeconds(0);
    durationRef.current = 0;

    clearTimer();
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      if (isMountedRef.current) {
        setDurationSeconds(durationRef.current);
      }
      if (durationRef.current >= MAX_RECORDING_DURATION_SECONDS) {
        void stopListening();
      }
    }, 1000);
  }, [clearTimer, onError, stopListening, t]);

  const toggleRecording = useCallback(() => {
    if (isTranscribing) {
      return;
    }
    if (isRecording) {
      void stopListening();
    } else {
      void startListening();
    }
  }, [isRecording, isTranscribing, startListening, stopListening]);

  const cancelListening = useCallback(async () => {
    clearTimer();
    setIsRecording(false);
    setIsTranscribing(false);
    setDurationSeconds(0);
    await cancelAudioRecording();
  }, [clearTimer]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {
    isRecording,
    isTranscribing,
    durationSeconds,
    errorMessage,
    toggleRecording,
    startListening,
    stopListening,
    cancelListening,
    clearError,
  };
}
