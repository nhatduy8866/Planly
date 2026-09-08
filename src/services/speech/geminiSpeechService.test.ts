import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as FileSystem from 'expo-file-system/legacy';
import { transcribeAudioWithGemini } from './geminiSpeechService';

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

describe('geminiSpeechService', () => {
  const originalFetch = global.fetch;
  const mockReadAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<
    (fileUri: string, options?: any) => Promise<string>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws MISSING_GEMINI_API_KEY when no key is provided and env is empty', async () => {
    const originalKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    await expect(
      transcribeAudioWithGemini('file:///test.m4a', 'audio/mp4', ''),
    ).rejects.toThrow('MISSING_GEMINI_API_KEY');

    process.env.EXPO_PUBLIC_GEMINI_API_KEY = originalKey;
  });

  it('throws EMPTY_AUDIO_DATA when audio file base64 is empty', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('');

    await expect(
      transcribeAudioWithGemini('file:///empty.m4a', 'audio/mp4', 'test-key'),
    ).rejects.toThrow('EMPTY_AUDIO_DATA');
  });

  it('successfully transcribes audio and trims quotes from result', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_AUDIO_CONTENT');

    const fetchMock = jest.fn<any>().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '“Mai 9h sáng họp team 1 tiếng”' }],
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    const result = await transcribeAudioWithGemini(
      'file:///test.m4a',
      'audio/mp4',
      'test-key',
    );

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///test.m4a', {
      encoding: 'base64',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callArgs = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(callArgs[0]).toContain('gemini-2.5-flash');
    expect(callArgs[0]).toContain('key=test-key');

    const body = JSON.parse(callArgs[1].body);
    expect(body.contents[0].parts[0].inlineData).toEqual({
      mimeType: 'audio/mp4',
      data: 'BASE64_AUDIO_CONTENT',
    });

    expect(result).toBe('Mai 9h sáng họp team 1 tiếng');
  });

  it('retries with fallback model when the primary model fails', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_DATA');

    const fetchMock = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Chiều 2h làm báo cáo' }],
              },
            },
          ],
        }),
      });
    global.fetch = fetchMock as any;

    const result = await transcribeAudioWithGemini(
      'file:///test.m4a',
      'audio/mp4',
      'test-key',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toBe('Chiều 2h làm báo cáo');
  });
});
