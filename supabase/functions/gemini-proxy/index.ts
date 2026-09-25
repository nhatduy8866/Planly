const ALLOWED_MODEL = 'gemini-3.5-flash';
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const GEMINI_TIMEOUT_MS = 45_000;

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readPublishableKey(): string | undefined {
  const configuredKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (configuredKeys) {
    try {
      const parsed = JSON.parse(configuredKeys) as Record<string, unknown>;
      const defaultKey = parsed.default;
      if (typeof defaultKey === 'string' && defaultKey) return defaultKey;
      const firstKey = Object.values(parsed).find(
        (value): value is string => typeof value === 'string' && Boolean(value),
      );
      if (firstKey) return firstKey;
    } catch {
      // Fall through to the legacy key for older Supabase projects.
    }
  }
  return Deno.env.get('SUPABASE_ANON_KEY') || undefined;
}

async function hasAuthenticatedUser(request: Request): Promise<boolean> {
  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = readPublishableKey();
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !publishableKey) {
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: authorization,
      },
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function validateGeminiRequest(value: unknown): Record<string, unknown> | null {
  const request = asRecord(value);
  if (!request || !Array.isArray(request.contents) || !request.contents.length) {
    return null;
  }

  const allowedKeys = new Set(['contents', 'generationConfig']);
  if (Object.keys(request).some((key) => !allowedKeys.has(key))) {
    return null;
  }
  if (
    request.generationConfig !== undefined &&
    !asRecord(request.generationConfig)
  ) {
    return null;
  }

  return request;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(
      { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' },
      405,
    );
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(
      { code: 'REQUEST_TOO_LARGE', message: 'Request payload is too large.' },
      413,
    );
  }
  if (!(await hasAuthenticatedUser(request))) {
    return jsonResponse(
      { code: 'AUTH_REQUIRED', message: 'A valid user session is required.' },
      401,
    );
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse(
      { code: 'GEMINI_NOT_CONFIGURED', message: 'Gemini is not configured.' },
      503,
    );
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = asRecord(await request.json());
  } catch {
    return jsonResponse(
      { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      400,
    );
  }

  if (body?.model !== ALLOWED_MODEL) {
    return jsonResponse(
      { code: 'MODEL_NOT_ALLOWED', message: 'The requested model is not allowed.' },
      400,
    );
  }
  const geminiRequest = validateGeminiRequest(body.request);
  if (!geminiRequest) {
    return jsonResponse(
      { code: 'INVALID_REQUEST', message: 'Invalid Gemini request payload.' },
      400,
    );
  }
  if (JSON.stringify(geminiRequest).length > MAX_REQUEST_BYTES) {
    return jsonResponse(
      { code: 'REQUEST_TOO_LARGE', message: 'Request payload is too large.' },
      413,
    );
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ALLOWED_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(geminiRequest),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );

    if (!upstream.ok) {
      console.error(`Gemini upstream request failed with HTTP ${upstream.status}.`);
      return jsonResponse(
        {
          code: 'GEMINI_UPSTREAM_ERROR',
          message: 'Gemini request failed.',
          upstreamStatus: upstream.status,
        },
        502,
      );
    }

    const responseBody = await upstream.json();
    if (!asRecord(responseBody)) {
      return jsonResponse(
        { code: 'GEMINI_INVALID_RESPONSE', message: 'Gemini returned invalid JSON.' },
        502,
      );
    }
    return jsonResponse(responseBody);
  } catch (error) {
    console.error(
      `Gemini proxy failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return jsonResponse(
      { code: 'GEMINI_PROXY_FAILED', message: 'Gemini request failed.' },
      502,
    );
  }
});
