const ALLOWED_MODEL = "gemini-3.5-flash";
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const GEMINI_TIMEOUT_MS = 45_000;
const QUOTA_TIMEOUT_MS = 10_000;
const DAILY_REQUEST_LIMIT = 50;

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  additionalHeaders: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders, ...additionalHeaders },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readPublishableKey(): string | undefined {
  const configuredKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (configuredKeys) {
    try {
      const parsed = JSON.parse(configuredKeys) as Record<string, unknown>;
      const defaultKey = parsed.default;
      if (typeof defaultKey === "string" && defaultKey) return defaultKey;
      const firstKey = Object.values(parsed).find(
        (value): value is string => typeof value === "string" && Boolean(value),
      );
      if (firstKey) return firstKey;
    } catch {
      // Fall through to the legacy key for older Supabase projects.
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") || undefined;
}

async function getAuthenticatedUserId(
  request: Request,
): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = readPublishableKey();
  if (
    !authorization?.startsWith("Bearer ") || !supabaseUrl || !publishableKey
  ) {
    return null;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: authorization,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;

    const user = asRecord(await response.json());
    return typeof user?.id === "string" && user.id ? user.id : null;
  } catch {
    return null;
  }
}

interface DailyQuota {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  resetsAt: string;
}

async function consumeDailyQuota(userId: string): Promise<DailyQuota | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/consume_gemini_daily_quota`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_user_id: userId }),
        signal: AbortSignal.timeout(QUOTA_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      console.error(`Gemini quota check failed with HTTP ${response.status}.`);
      return null;
    }

    const payload = await response.json();
    const row = Array.isArray(payload)
      ? asRecord(payload[0])
      : asRecord(payload);
    if (
      typeof row?.allowed !== "boolean" ||
      typeof row.used !== "number" ||
      typeof row.remaining !== "number" ||
      typeof row.daily_limit !== "number" ||
      typeof row.resets_at !== "string"
    ) {
      return null;
    }

    return {
      allowed: row.allowed,
      used: row.used,
      remaining: row.remaining,
      limit: row.daily_limit,
      resetsAt: row.resets_at,
    };
  } catch (error) {
    console.error(
      `Gemini quota check failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return null;
  }
}

function validateGeminiRequest(value: unknown): Record<string, unknown> | null {
  const request = asRecord(value);
  if (
    !request || !Array.isArray(request.contents) || !request.contents.length
  ) {
    return null;
  }

  const allowedKeys = new Set(["contents", "generationConfig"]);
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
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { code: "METHOD_NOT_ALLOWED", message: "Only POST is supported." },
      405,
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(
      { code: "REQUEST_TOO_LARGE", message: "Request payload is too large." },
      413,
    );
  }
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return jsonResponse(
      { code: "AUTH_REQUIRED", message: "A valid user session is required." },
      401,
    );
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse(
      { code: "GEMINI_NOT_CONFIGURED", message: "Gemini is not configured." },
      503,
    );
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = asRecord(await request.json());
  } catch {
    return jsonResponse(
      { code: "INVALID_JSON", message: "Request body must be valid JSON." },
      400,
    );
  }

  if (body?.model !== ALLOWED_MODEL) {
    return jsonResponse(
      {
        code: "MODEL_NOT_ALLOWED",
        message: "The requested model is not allowed.",
      },
      400,
    );
  }
  const geminiRequest = validateGeminiRequest(body.request);
  if (!geminiRequest) {
    return jsonResponse(
      { code: "INVALID_REQUEST", message: "Invalid Gemini request payload." },
      400,
    );
  }
  if (JSON.stringify(geminiRequest).length > MAX_REQUEST_BYTES) {
    return jsonResponse(
      { code: "REQUEST_TOO_LARGE", message: "Request payload is too large." },
      413,
    );
  }

  const quota = await consumeDailyQuota(userId);
  if (!quota) {
    return jsonResponse(
      {
        code: "QUOTA_CHECK_FAILED",
        message: "AI usage limit could not be checked.",
      },
      503,
    );
  }

  const quotaHeaders = {
    "X-RateLimit-Limit": String(quota.limit),
    "X-RateLimit-Remaining": String(quota.remaining),
    "X-RateLimit-Reset": quota.resetsAt,
  };
  if (!quota.allowed) {
    return jsonResponse(
      {
        code: "DAILY_LIMIT_REACHED",
        message:
          `The daily limit of ${DAILY_REQUEST_LIMIT} AI requests has been reached.`,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
        resetsAt: quota.resetsAt,
      },
      429,
      quotaHeaders,
    );
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ALLOWED_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(geminiRequest),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    );

    if (!upstream.ok) {
      console.error(
        `Gemini upstream request failed with HTTP ${upstream.status}.`,
      );
      return jsonResponse(
        {
          code: "GEMINI_UPSTREAM_ERROR",
          message: "Gemini request failed.",
          upstreamStatus: upstream.status,
        },
        502,
        quotaHeaders,
      );
    }

    const responseBody = await upstream.json();
    if (!asRecord(responseBody)) {
      return jsonResponse(
        {
          code: "GEMINI_INVALID_RESPONSE",
          message: "Gemini returned invalid JSON.",
        },
        502,
        quotaHeaders,
      );
    }
    return jsonResponse(responseBody, 200, quotaHeaders);
  } catch (error) {
    console.error(
      `Gemini proxy failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return jsonResponse(
      { code: "GEMINI_PROXY_FAILED", message: "Gemini request failed." },
      502,
      quotaHeaders,
    );
  }
});
