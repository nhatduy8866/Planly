import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import {
  GEMINI_FLASH_MODEL,
  type GeminiContentGateway,
  type GeminiModel,
} from '../ai/geminiProxy';

const GEMINI_MODELS: readonly GeminiModel[] = [GEMINI_FLASH_MODEL];
const TRANSCRIPTION_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('GEMINI_PROXY_TIMEOUT')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Đọc nội dung file âm thanh thành chuỗi base64
 */
export async function readAudioAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex !== -1) {
          resolve(dataUrl.slice(commaIndex + 1));
        } else {
          resolve(dataUrl);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Gửi âm thanh tới Gemini 3.5 Flash để nhận diện thành văn bản tiếng Việt
 */
export async function transcribeAudioWithGemini(
  uri: string,
  mimeType = 'audio/mp4',
  requestGeminiContent: GeminiContentGateway,
): Promise<string> {
  const base64Data = await readAudioAsBase64(uri);
  if (!base64Data) {
    throw new Error('EMPTY_AUDIO_DATA');
  }

  const promptText =
    'Bạn là bộ nhận diện giọng nói (Speech-to-Text) tiếng Việt cho ứng dụng lập kế hoạch Planly. ' +
    'Hãy nghe đoạn âm thanh này và chuyển thành văn bản tiếng Việt chuẩn xác, giữ đúng các từ chỉ thời gian, ' +
    'ngày tháng (ví dụ: mai, 9h, chiều 2h). ' +
    'Quy tắc nghiêm ngặt: Chỉ trả về duy nhất nội dung văn bản người dùng nói, ' +
    'không thêm lời giải thích, không thêm dấu ngoặc kép bao quanh, không thêm bất kỳ định dạng nào.';

  let lastError: unknown = null;

  for (const model of GEMINI_MODELS) {
    try {
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: promptText,
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: 'MINIMAL',
          },
        },
      };
      const data = await withTimeout(
        requestGeminiContent(model, payload),
        TRANSCRIPTION_TIMEOUT_MS,
      ) as {
        candidates?: {
          content?: {
            parts?: { thought?: boolean; text?: string }[];
          };
        }[];
      };
      const responseParts = data?.candidates?.[0]?.content?.parts;
      const candidateText = Array.isArray(responseParts)
        ? responseParts
            .filter((part) => !part?.thought && typeof part?.text === 'string')
            .map((part) => part.text)
            .join('\n')
        : '';
      if (candidateText) {
        const cleanText = candidateText.trim().replace(/^["'“](.*)["'”]$/, '$1').trim();
        if (cleanText) {
          return cleanText;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('TRANSLATION_FAILED');
}
