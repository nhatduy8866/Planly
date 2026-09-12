import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { AlarmFilePreference } from '../types';

export type AlarmMediaKind = 'background' | 'sound';

const MAX_FILE_SIZE: Record<AlarmMediaKind, number> = {
  background: 10 * 1024 * 1024,
  sound: 20 * 1024 * 1024,
};

const MIME_TYPE: Record<AlarmMediaKind, string> = {
  background: 'image/*',
  sound: 'audio/*',
};

const FALLBACK_EXTENSION: Record<AlarmMediaKind, string> = {
  background: '.jpg',
  sound: '.mp3',
};

export class AlarmMediaError extends Error {
  constructor(
    readonly reason: 'fileTooLarge' | 'unsupported',
  ) {
    super(reason);
  }
}

function fileExtension(name: string, kind: AlarmMediaKind): string {
  const match = name.match(/\.[a-zA-Z0-9]{1,8}$/);
  return match?.[0].toLowerCase() ?? FALLBACK_EXTENSION[kind];
}

export async function pickAlarmMedia(
  kind: AlarmMediaKind,
): Promise<AlarmFilePreference | undefined> {
  if (Platform.OS === 'web') throw new AlarmMediaError('unsupported');

  const result = await DocumentPicker.getDocumentAsync({
    base64: false,
    copyToCacheDirectory: true,
    multiple: false,
    type: MIME_TYPE[kind],
  });
  if (result.canceled) return undefined;

  const asset = result.assets[0];
  if (!asset) return undefined;
  if (asset.size !== undefined && asset.size > MAX_FILE_SIZE[kind]) {
    throw new AlarmMediaError('fileTooLarge');
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new AlarmMediaError('unsupported');

  const mediaDirectory = `${documentDirectory}planly-alarm-media/`;
  await FileSystem.makeDirectoryAsync(mediaDirectory, { intermediates: true });
  const storedUri = `${mediaDirectory}${kind}-${Date.now()}${fileExtension(
    asset.name,
    kind,
  )}`;
  await FileSystem.copyAsync({ from: asset.uri, to: storedUri });

  return { name: asset.name, uri: storedUri };
}
