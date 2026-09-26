import type { Session } from '@supabase/supabase-js';

export const GEMINI_FLASH_MODEL = 'gemini-3.5-flash' as const;

export type GeminiModel = typeof GEMINI_FLASH_MODEL;
export type GeminiRequest = Record<string, unknown>;
export type GeminiContentGateway = (
  model: GeminiModel,
  request: GeminiRequest,
) => Promise<unknown>;

export interface GeminiProxyClient {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
  };
  functions: {
    invoke: (
      functionName: string,
      options: {
        body: { model: GeminiModel; request: GeminiRequest };
        headers: { Authorization: string };
      },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

export type GeminiProxyErrorCode =
  | 'SUPABASE_NOT_CONFIGURED'
  | 'GEMINI_SIGN_IN_REQUIRED'
  | 'GEMINI_PROXY_AUTH_FAILED'
  | 'GEMINI_PROXY_REQUEST_FAILED'
  | 'GEMINI_PROXY_INVALID_RESPONSE';

export type GeminiProxyMessageKey =
  | 'ai.cloudSignInRequired'
  | 'ai.cloudSessionExpired'
  | 'ai.dailyLimitReached'
  | 'ai.cloudNotConfigured'
  | 'ai.quotaCheckFailed'
  | 'ai.cloudUnavailable';

export class GeminiProxyError extends Error {
  constructor(
    readonly code: GeminiProxyErrorCode,
    message: string,
    readonly status?: number,
    readonly serverCode?: string,
  ) {
    super(message);
    this.name = 'GeminiProxyError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

async function readFunctionError(error: unknown): Promise<{
  code?: string;
  message: string;
  status?: number;
}> {
  const record = asRecord(error);
  const context = record?.context;
  let responseBody: Record<string, unknown> | null = null;

  if (context instanceof Response) {
    try {
      responseBody = asRecord(await context.clone().json());
    } catch {
      responseBody = null;
    }
  }

  const message =
    (typeof responseBody?.message === 'string' && responseBody.message) ||
    (typeof record?.message === 'string' && record.message) ||
    'Gemini proxy request failed.';
  const code =
    typeof responseBody?.code === 'string' ? responseBody.code : undefined;
  const status = context instanceof Response ? context.status : undefined;

  return { code, message, status };
}

export function createGeminiProxyGateway(
  client: GeminiProxyClient | null,
): GeminiContentGateway {
  return async (model, request) => {
    if (!client) {
      throw new GeminiProxyError(
        'SUPABASE_NOT_CONFIGURED',
        'Supabase is not configured.',
      );
    }

    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();
    if (sessionError) {
      throw new GeminiProxyError(
        'GEMINI_PROXY_AUTH_FAILED',
        sessionError.message,
      );
    }

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new GeminiProxyError(
        'GEMINI_SIGN_IN_REQUIRED',
        'Sign in to use Gemini features.',
        401,
      );
    }

    const { data, error } = await client.functions.invoke('gemini-proxy', {
      body: { model, request },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) {
      const details = await readFunctionError(error);
      throw new GeminiProxyError(
        'GEMINI_PROXY_REQUEST_FAILED',
        details.code ? `${details.code}: ${details.message}` : details.message,
        details.status,
        details.code,
      );
    }
    if (!asRecord(data)) {
      throw new GeminiProxyError(
        'GEMINI_PROXY_INVALID_RESPONSE',
        'Gemini proxy returned an invalid response.',
      );
    }

    return data;
  };
}

export function isGeminiProxySetupError(
  error: unknown,
): error is GeminiProxyError {
  if (!(error instanceof GeminiProxyError)) return false;
  if (
    error.code === 'SUPABASE_NOT_CONFIGURED' ||
    error.code === 'GEMINI_SIGN_IN_REQUIRED' ||
    error.code === 'GEMINI_PROXY_AUTH_FAILED'
  ) {
    return true;
  }
  return (
    error.serverCode === 'AUTH_REQUIRED' ||
    error.serverCode === 'GEMINI_NOT_CONFIGURED' ||
    error.status === 401 ||
    error.status === 404 ||
    error.status === 503
  );
}

export function shouldSurfaceGeminiProxyError(
  error: unknown,
): error is GeminiProxyError {
  return isGeminiProxySetupError(error) || (
    error instanceof GeminiProxyError &&
    (error.serverCode === 'DAILY_LIMIT_REACHED' || error.status === 429)
  );
}

export function getGeminiProxyMessageKey(
  error: GeminiProxyError,
): GeminiProxyMessageKey {
  if (error.code === 'GEMINI_PROXY_AUTH_FAILED') {
    return 'ai.cloudSessionExpired';
  }
  if (
    error.code === 'GEMINI_SIGN_IN_REQUIRED' ||
    error.serverCode === 'AUTH_REQUIRED' ||
    error.status === 401
  ) {
    return 'ai.cloudSignInRequired';
  }
  if (error.serverCode === 'DAILY_LIMIT_REACHED' || error.status === 429) {
    return 'ai.dailyLimitReached';
  }
  if (
    error.code === 'SUPABASE_NOT_CONFIGURED' ||
    error.serverCode === 'GEMINI_NOT_CONFIGURED' ||
    error.serverCode === 'RATE_LIMIT_NOT_CONFIGURED'
  ) {
    return 'ai.cloudNotConfigured';
  }
  if (error.serverCode === 'QUOTA_CHECK_FAILED') {
    return 'ai.quotaCheckFailed';
  }
  return 'ai.cloudUnavailable';
}
