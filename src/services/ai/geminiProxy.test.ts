import { describe, expect, it, jest } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

import {
  GeminiProxyError,
  createGeminiProxyGateway,
  getGeminiProxyMessageKey,
  shouldSurfaceGeminiProxyError,
  type GeminiProxyClient,
} from './geminiProxy';

function makeSession(): Session {
  return { access_token: 'user-access-token' } as Session;
}

function makeClient(options?: {
  session?: Session | null;
  sessionError?: { message: string } | null;
  invokeData?: unknown;
  invokeError?: unknown;
}) {
  const session = options && 'session' in options
    ? options.session ?? null
    : makeSession();
  const invoke = jest.fn<GeminiProxyClient['functions']['invoke']>()
    .mockResolvedValue({
      data: options?.invokeData ?? { candidates: [] },
      error: options?.invokeError ?? null,
    });
  const client: GeminiProxyClient = {
    auth: {
      getSession: jest.fn<GeminiProxyClient['auth']['getSession']>()
        .mockResolvedValue({
          data: { session },
          error: options?.sessionError ?? null,
        }),
    },
    functions: { invoke },
  };
  return { client, invoke };
}

describe('Gemini proxy gateway', () => {
  it('requires Supabase configuration', async () => {
    await expect(
      createGeminiProxyGateway(null)('gemini-3.5-flash', { contents: [] }),
    ).rejects.toMatchObject({ code: 'SUPABASE_NOT_CONFIGURED' });
  });

  it('requires a signed-in user session', async () => {
    const { client, invoke } = makeClient({ session: null });

    await expect(
      createGeminiProxyGateway(client)('gemini-3.5-flash', { contents: [] }),
    ).rejects.toMatchObject({ code: 'GEMINI_SIGN_IN_REQUIRED', status: 401 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('invokes the protected function with the user access token', async () => {
    const response = { candidates: [{ content: { parts: [{ text: '[]' }] } }] };
    const { client, invoke } = makeClient({ invokeData: response });

    await expect(
      createGeminiProxyGateway(client)('gemini-3.5-flash', {
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      }),
    ).resolves.toEqual(response);
    expect(invoke).toHaveBeenCalledWith('gemini-proxy', {
      body: {
        model: 'gemini-3.5-flash',
        request: {
          contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        },
      },
      headers: { Authorization: 'Bearer user-access-token' },
    });
  });

  it('normalizes invocation failures without exposing a secret', async () => {
    const { client } = makeClient({
      invokeError: { message: 'Function returned 503' },
    });

    await expect(
      createGeminiProxyGateway(client)('gemini-3.5-flash', { contents: [] }),
    ).rejects.toEqual(expect.objectContaining({
      code: 'GEMINI_PROXY_REQUEST_FAILED',
      message: 'Function returned 503',
    }));
  });

  it('preserves the daily-limit response for a user-facing message', async () => {
    const context = new Response(
      JSON.stringify({
        code: 'DAILY_LIMIT_REACHED',
        message: 'Daily limit reached.',
        limit: 50,
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const { client } = makeClient({
      invokeError: { message: 'Function returned 429', context },
    });

    const error = await createGeminiProxyGateway(client)(
      'gemini-3.5-flash',
      { contents: [] },
    ).catch((caught: unknown) => caught);

    expect(error).toEqual(expect.objectContaining({
      code: 'GEMINI_PROXY_REQUEST_FAILED',
      serverCode: 'DAILY_LIMIT_REACHED',
      status: 429,
    }));
    expect(error).toBeInstanceOf(GeminiProxyError);
    if (!(error instanceof GeminiProxyError)) {
      throw new Error('Expected GeminiProxyError.');
    }
    expect(shouldSurfaceGeminiProxyError(error)).toBe(true);
    expect(getGeminiProxyMessageKey(error)).toBe(
      'ai.dailyLimitReached',
    );
  });

  it.each<[string, number, string]>([
    ['AUTH_REQUIRED', 401, 'ai.cloudSignInRequired'],
    ['GEMINI_NOT_CONFIGURED', 503, 'ai.cloudNotConfigured'],
    ['QUOTA_CHECK_FAILED', 503, 'ai.quotaCheckFailed'],
    ['GEMINI_UPSTREAM_ERROR', 502, 'ai.cloudUnavailable'],
  ])(
    'maps %s to the correct localized message',
    (serverCode, status, expectedKey) => {
      const error = new GeminiProxyError(
        'GEMINI_PROXY_REQUEST_FAILED',
        serverCode,
        status,
        serverCode,
      );

      expect(getGeminiProxyMessageKey(error)).toBe(expectedKey);
    },
  );

  it('distinguishes missing configuration from an expired session', () => {
    expect(getGeminiProxyMessageKey(new GeminiProxyError(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase is not configured.',
    ))).toBe('ai.cloudNotConfigured');
    expect(getGeminiProxyMessageKey(new GeminiProxyError(
      'GEMINI_PROXY_AUTH_FAILED',
      'Session refresh failed.',
    ))).toBe('ai.cloudSessionExpired');
  });
});
