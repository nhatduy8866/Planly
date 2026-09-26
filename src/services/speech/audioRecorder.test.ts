import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioRecorder,
} from 'expo-audio';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import {
  startAudioRecording,
  stopAudioRecording,
  cancelAudioRecording,
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

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn(async () => undefined),
}));

const mockDeleteAsync = FileSystem.deleteAsync as jest.MockedFunction<
  typeof FileSystem.deleteAsync
>;

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
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRecordingPermissions.mockResolvedValue({ granted: true } as never);
    mockSetAudioMode.mockResolvedValue(undefined);
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
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

  it('labels Android HIGH_QUALITY recordings as M4A for Gemini', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    const recorder = makeRecorder();

    await expect(startAudioRecording(recorder)).resolves.toBe(true);

    await expect(stopAudioRecording()).resolves.toMatchObject({
      uri: 'file:///recording.m4a',
      mimeType: 'audio/m4a',
    });
  });

  it('deletes a cancelled native recording', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    const recorder = makeRecorder();

    await startAudioRecording(recorder);
    await cancelAudioRecording();

    expect(mockDeleteAsync).toHaveBeenCalledWith(
      'file:///recording.m4a',
      { idempotent: true },
    );
  });
});
