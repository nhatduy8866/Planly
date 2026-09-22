import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioRecorder,
} from 'expo-audio';

import {
  startAudioRecording,
  stopAudioRecording,
  usePlanlyAudioRecorder,
} from './audioRecorder';

jest.mock('expo-audio', () => ({
  RecordingPresets: {
    HIGH_QUALITY: { extension: '.m4a' },
  },
  getRecordingPermissionsAsync: jest.fn(),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
  useAudioRecorder: jest.fn(),
}));

const mockGetRecordingPermissions = getRecordingPermissionsAsync as jest.MockedFunction<
  typeof getRecordingPermissionsAsync
>;
const mockSetAudioMode = setAudioModeAsync as jest.MockedFunction<
  typeof setAudioModeAsync
>;
const mockUseAudioRecorder = useAudioRecorder as jest.MockedFunction<
  typeof useAudioRecorder
>;

function makeRecorder(): AudioRecorder {
  return {
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    uri: 'file:///recording.m4a',
  } as unknown as AudioRecorder;
}

describe('audioRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRecordingPermissions.mockResolvedValue({ granted: true } as never);
    mockSetAudioMode.mockResolvedValue(undefined);
  });

  it('creates the recorder through the public Expo hook', () => {
    const recorder = makeRecorder();
    mockUseAudioRecorder.mockReturnValue(recorder);

    expect(usePlanlyAudioRecorder()).toBe(recorder);
    expect(mockUseAudioRecorder).toHaveBeenCalledWith({ extension: '.m4a' });
  });

  it('records with the managed recorder and restores audio mode after stopping', async () => {
    const recorder = makeRecorder();

    await expect(startAudioRecording(recorder)).resolves.toBe(true);
    expect(recorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledTimes(1);

    const result = await stopAudioRecording();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      uri: 'file:///recording.m4a',
    });
    expect(mockSetAudioMode).toHaveBeenLastCalledWith({ allowsRecording: false });
  });
});
