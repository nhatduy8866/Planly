import { useCallback, useEffect, useRef, useState } from 'react';

import { usePreferences } from '../preferences/PreferencesContext';
import {
  GeminiProxyError,
  getGeminiOfflineFallbackReason,
  getGeminiProxyMessageKey,
} from '../services/ai/geminiProxy';
import { generateGeminiContent } from '../services/ai/geminiProxyClient';
import {
  cancelAudioRecording,
  deleteAudioRecording,
  startAudioRecording,
  stopAudioRecording,
  usePlanlyAudioRecorder,
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
  const recorder = usePlanlyAudioRecorder();
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

    let recordingUri: string | null = null;
    try {
      const recordingResult = await stopAudioRecording();
      if (!recordingResult) {
        return;
      }
      recordingUri = recordingResult.uri;

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
          generateGeminiContent,
        );

        if (isMountedRef.current && transcript) {
          onTranscript(transcript);
        }
      } catch (err) {
        console.warn('Lỗi nhận diện giọng nói qua Gemini:', err);
        const fallbackReason = getGeminiOfflineFallbackReason(err);
        const fallbackMessageKeys = {
          signed_out: 'ai.voiceSignInRequired',
          network_unavailable: 'ai.voiceNoConnection',
          daily_limit: 'ai.voiceDailyLimit',
        } as const;
        const localizedFallbackMessage = fallbackReason
          ? t(fallbackMessageKeys[fallbackReason])
          : null;
        const errorMsg = localizedFallbackMessage
          ? localizedFallbackMessage
          : err instanceof GeminiProxyError
            ? t(getGeminiProxyMessageKey(err))
            : t('ai.voiceError');
        if (isMountedRef.current) {
          setErrorMessage(errorMsg);
        }
        onError?.(errorMsg);
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
    } finally {
      await deleteAudioRecording(recordingUri);
    }
  }, [clearTimer, onError, onTranscript, t]);

  const startListening = useCallback(async () => {
    setErrorMessage(null);

    const started = await startAudioRecording(recorder);
    if (!started) {
      const permMsg = t('ai.voicePermissionDenied');
      setErrorMessage(permMsg);
      onError?.(permMsg);
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
  }, [clearTimer, onError, recorder, stopListening, t]);

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
