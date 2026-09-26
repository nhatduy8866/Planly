import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as FileSystem from 'expo-file-system/legacy';
import type { GeminiContentGateway } from '../ai/geminiProxy';
import { transcribeAudioWithGemini } from './geminiSpeechService';

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

const testGateway: GeminiContentGateway = async (model, request) => {
  const response = await fetch(
    `https://gemini.test/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini test gateway failed with HTTP ${response.status}.`);
  }
  return response.json();
};

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

  it('surfaces an authenticated proxy failure', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_AUDIO_CONTENT');
    const failingGateway = jest
      .fn<GeminiContentGateway>()
      .mockRejectedValue(new Error('GEMINI_SIGN_IN_REQUIRED'));

    await expect(
      transcribeAudioWithGemini(
        'file:///test.m4a',
        'audio/m4a',
        failingGateway,
      ),
    ).rejects.toThrow('GEMINI_SIGN_IN_REQUIRED');
  });

  it('throws EMPTY_AUDIO_DATA when audio file base64 is empty', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('');

    await expect(
      transcribeAudioWithGemini('file:///empty.m4a', 'audio/m4a', testGateway),
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
              parts: [
                { thought: true, text: 'Phân tích âm thanh' },
                { text: '“Mai 9h sáng họp team”' },
              ],
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    const result = await transcribeAudioWithGemini(
      'file:///test.m4a',
      'audio/m4a',
      testGateway,
    );

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///test.m4a', {
      encoding: 'base64',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callArgs = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(callArgs[0]).toContain('gemini-3.5-flash');
    expect(callArgs[0]).not.toContain('key=');

    const body = JSON.parse(callArgs[1].body);
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: 'audio/m4a',
      data: 'BASE64_AUDIO_CONTENT',
    });
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('MINIMAL');

    expect(result).toBe('Mai 9h sáng họp team');
  });

  it('surfaces a Gemini 3.5 Flash API failure', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_DATA');

    const fetchMock = jest
      .fn<any>()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });
    global.fetch = fetchMock as any;

    await expect(
      transcribeAudioWithGemini(
        'file:///test.m4a',
        'audio/m4a',
        testGateway,
      ),
    ).rejects.toThrow('Gemini test gateway failed with HTTP 503');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
