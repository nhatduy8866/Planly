import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

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
 * Gửi âm thanh tới Gemini 2.5 Flash để nhận diện thành văn bản tiếng Việt
 */
export async function transcribeAudioWithGemini(
  uri: string,
  mimeType = 'audio/mp4',
  apiKey?: string,
): Promise<string> {
  const key = apiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!key) {
    throw new Error('MISSING_GEMINI_API_KEY');
  }

  const base64Data = await readAudioAsBase64(uri);
  if (!base64Data) {
    throw new Error('EMPTY_AUDIO_DATA');
  }

  const promptText =
    'Bạn là bộ nhận diện giọng nói (Speech-to-Text) tiếng Việt cho ứng dụng lập kế hoạch Planly. ' +
    'Hãy nghe đoạn âm thanh này và chuyển thành văn bản tiếng Việt chuẩn xác, giữ đúng các từ chỉ thời gian, ' +
    'ngày tháng (ví dụ: mai, 9h, chiều 2h, nhắc trước 15 phút). ' +
    'Quy tắc nghiêm ngặt: Chỉ trả về duy nhất nội dung văn bản người dùng nói, ' +
    'không thêm lời giải thích, không thêm dấu ngoặc kép bao quanh, không thêm bất kỳ định dạng nào.';

  let lastError: unknown = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        lastError = new Error(`Gemini STT API error ${res.status}: ${errorBody}`);
        continue;
      }

      const data = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText && typeof candidateText === 'string') {
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
