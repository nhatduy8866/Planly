import { act, createElement } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { useVoiceInput } from './useVoiceInput';
import {
  startAudioRecording,
  stopAudioRecording,
  cancelAudioRecording,
} from '../services/speech/audioRecorder';
import { transcribeAudioWithGemini } from '../services/speech/geminiSpeechService';

const mockStartAudioRecording = jest.fn<typeof startAudioRecording>();
const mockStopAudioRecording = jest.fn<typeof stopAudioRecording>();
const mockCancelAudioRecording = jest.fn<typeof cancelAudioRecording>();
const mockTranscribeAudioWithGemini = jest.fn<typeof transcribeAudioWithGemini>();

jest.mock('../services/speech/audioRecorder', () => ({
  startAudioRecording: () => mockStartAudioRecording(),
  stopAudioRecording: () => mockStopAudioRecording(),
  cancelAudioRecording: () => mockCancelAudioRecording(),
}));

jest.mock('../services/speech/geminiSpeechService', () => ({
  transcribeAudioWithGemini: (...args: Parameters<typeof transcribeAudioWithGemini>) =>
    mockTranscribeAudioWithGemini(...args),
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
}));

interface TestRendererInstance {
  unmount(): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

describe('useVoiceInput', () => {
  let hook!: ReturnType<typeof useVoiceInput>;
  let renderer!: TestRendererInstance;
  let onTranscriptMock: jest.Mock<(text: string) => void>;
  let onErrorMock: jest.Mock<(err: string) => void>;

  function Harness() {
    hook = useVoiceInput({
      onTranscript: onTranscriptMock,
      onError: onErrorMock,
    });
    return null;
  }

  async function renderHook() {
    await act(async () => {
      renderer = create(createElement(Harness));
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    onTranscriptMock = jest.fn();
    onErrorMock = jest.fn();
    await renderHook();
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts in idle state', () => {
    expect(hook.isRecording).toBe(false);
    expect(hook.isTranscribing).toBe(false);
    expect(hook.durationSeconds).toBe(0);
    expect(hook.errorMessage).toBeNull();
  });

  it('handles permission denied when starting recording', async () => {
    mockStartAudioRecording.mockResolvedValueOnce(false);

    await act(async () => {
      await hook.startListening();
    });

    expect(hook.isRecording).toBe(false);
    expect(hook.errorMessage).toBe('ai.voicePermissionDenied');
    expect(onErrorMock).toHaveBeenCalledWith('ai.voicePermissionDenied');
  });

  it('records and transcribes successfully when stopped', async () => {
    mockStartAudioRecording.mockResolvedValueOnce(true);
    mockStopAudioRecording.mockResolvedValueOnce({
      uri: 'file:///sample.m4a',
      durationMs: 2500,
      mimeType: 'audio/mp4',
    });
    mockTranscribeAudioWithGemini.mockResolvedValueOnce('Mai 9h họp team');

    await act(async () => {
      await hook.startListening();
    });

    expect(hook.isRecording).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(hook.durationSeconds).toBe(2);

    await act(async () => {
      await hook.stopListening();
    });

    expect(hook.isRecording).toBe(false);
    expect(mockStopAudioRecording).toHaveBeenCalled();
    expect(mockTranscribeAudioWithGemini).toHaveBeenCalledWith(
      'file:///sample.m4a',
      'audio/mp4',
    );
    expect(onTranscriptMock).toHaveBeenCalledWith('Mai 9h họp team');
  });

  it('shows error when recording is too short', async () => {
    mockStartAudioRecording.mockResolvedValueOnce(true);
    mockStopAudioRecording.mockResolvedValueOnce({
      uri: 'file:///sample.m4a',
      durationMs: 200,
      mimeType: 'audio/mp4',
    });

    await act(async () => {
      await hook.startListening();
    });

    await act(async () => {
      await hook.stopListening();
    });

    expect(mockTranscribeAudioWithGemini).not.toHaveBeenCalled();
    expect(hook.errorMessage).toBe('ai.voiceTooShort');
    expect(onErrorMock).toHaveBeenCalledWith('ai.voiceTooShort');
  });

  it('cancels recording cleanly', async () => {
    mockStartAudioRecording.mockResolvedValueOnce(true);

    await act(async () => {
      await hook.startListening();
    });
    expect(hook.isRecording).toBe(true);

    await act(async () => {
      await hook.cancelListening();
    });

    expect(hook.isRecording).toBe(false);
    expect(mockCancelAudioRecording).toHaveBeenCalled();
    expect(mockTranscribeAudioWithGemini).not.toHaveBeenCalled();
  });
});
