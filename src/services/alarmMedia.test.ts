import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { pickAlarmMedia } from './alarmMedia';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  copyAsync: jest.fn(async () => undefined),
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(async () => undefined),
}));

const getDocumentAsync = jest.mocked(DocumentPicker.getDocumentAsync);
const copyAsync = jest.mocked(FileSystem.copyAsync);
const makeDirectoryAsync = jest.mocked(FileSystem.makeDirectoryAsync);

describe('alarm media picker', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('copies a selected file into durable app storage', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    jest.spyOn(Date, 'now').mockReturnValue(1234);
    getDocumentAsync.mockResolvedValue({
      assets: [
        {
          lastModified: 0,
          mimeType: 'audio/mpeg',
          name: 'morning.mp3',
          size: 1024,
          uri: 'file:///cache/morning.mp3',
        },
      ],
      canceled: false,
    });

    await expect(pickAlarmMedia('sound')).resolves.toEqual({
      name: 'morning.mp3',
      uri: 'file:///documents/planly-alarm-media/sound-1234.mp3',
    });
    expect(getDocumentAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        copyToCacheDirectory: true,
        multiple: false,
        type: 'audio/*',
      }),
    );
    expect(makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///documents/planly-alarm-media/',
      { intermediates: true },
    );
    expect(copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/morning.mp3',
      to: 'file:///documents/planly-alarm-media/sound-1234.mp3',
    });
  });

  it('rejects an image larger than the configured limit', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    getDocumentAsync.mockResolvedValue({
      assets: [
        {
          lastModified: 0,
          name: 'huge.jpg',
          size: 10 * 1024 * 1024 + 1,
          uri: 'file:///cache/huge.jpg',
        },
      ],
      canceled: false,
    });

    await expect(pickAlarmMedia('background')).rejects.toMatchObject({
      reason: 'fileTooLarge',
    });
    expect(copyAsync).not.toHaveBeenCalled();
  });
});
