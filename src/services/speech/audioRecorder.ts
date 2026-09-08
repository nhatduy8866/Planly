import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';

export interface RecordingResult {
  uri: string;
  durationMs: number;
  mimeType: string;
}

let activeRecorder: AudioRecorder | null = null;
let recordingStartTime = 0;

/**
 * Kiểm tra và yêu cầu quyền sử dụng Microphone
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  try {
    const current = await getRecordingPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await requestRecordingPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn('Lỗi kiểm tra quyền Microphone:', error);
    return false;
  }
}

/**
 * Bắt đầu ghi âm âm thanh
 */
export async function startAudioRecording(): Promise<boolean> {
  const hasPermission = await ensureMicrophonePermission();
  if (!hasPermission) {
    return false;
  }

  try {
    // Cấu hình audio session để cho phép ghi âm
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    // Nếu đang có recorder cũ chưa dừng, dừng và dọn dẹp trước
    if (activeRecorder) {
      try {
        await activeRecorder.stop();
      } catch {
        // bỏ qua lỗi dừng recorder cũ
      }
      activeRecorder = null;
    }

    const nativeAudio = AudioModule as unknown as {
      AudioRecorder: new (options: unknown) => AudioRecorder;
    };
    const recorder = new nativeAudio.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();

    activeRecorder = recorder;
    recordingStartTime = Date.now();
    return true;
  } catch (error) {
    console.warn('Lỗi bắt đầu ghi âm:', error);
    activeRecorder = null;
    return false;
  }
}

/**
 * Dừng ghi âm và trả về thông tin file âm thanh đã thu
 */
export async function stopAudioRecording(): Promise<RecordingResult | null> {
  if (!activeRecorder) {
    return null;
  }

  const recorder = activeRecorder;
  activeRecorder = null;
  const durationMs = Math.max(0, Date.now() - recordingStartTime);

  try {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      return null;
    }

    // Xác định mimeType phù hợp với preset
    let mimeType = 'audio/mp4';
    if (Platform.OS === 'web') {
      mimeType = 'audio/webm';
    } else if (Platform.OS === 'android') {
      mimeType = 'audio/mp4';
    } else if (Platform.OS === 'ios') {
      mimeType = 'audio/m4a';
    }

    return {
      uri,
      durationMs,
      mimeType,
    };
  } catch (error) {
    console.warn('Lỗi dừng ghi âm:', error);
    return null;
  }
}

/**
 * Hủy ghi âm đang diễn ra mà không lấy kết quả
 */
export async function cancelAudioRecording(): Promise<void> {
  if (!activeRecorder) {
    return;
  }
  const recorder = activeRecorder;
  activeRecorder = null;
  try {
    await recorder.stop();
  } catch {
    // bỏ qua lỗi
  }
}
