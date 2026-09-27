const MAX_REQUEST_BYTES = 1_024;

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
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

async function getAuthenticatedUserId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = readPublishableKey();
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !publishableKey) {
    return null;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: authorization },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const user = asRecord(await response.json());
    return typeof user?.id === "string" && user.id ? user.id : null;
  } catch {
    return null;
  }
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

  let body: Record<string, unknown> | null = null;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse(
        { code: "REQUEST_TOO_LARGE", message: "Request payload is too large." },
        413,
      );
    }
    body = asRecord(JSON.parse(rawBody));
  } catch {
    return jsonResponse(
      { code: "INVALID_JSON", message: "Request body must be valid JSON." },
      400,
    );
  }
  if (body?.confirm !== true || Object.keys(body).some((key) => key !== "confirm")) {
    return jsonResponse(
      { code: "CONFIRMATION_REQUIRED", message: "Account deletion must be confirmed." },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { code: "SERVICE_NOT_CONFIGURED", message: "Account deletion is not configured." },
      503,
    );
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      console.error(`Account deletion failed with HTTP ${response.status}.`);
      return jsonResponse(
        { code: "DELETE_FAILED", message: "Account deletion failed." },
        502,
      );
    }
    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error(
      `Account deletion failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return jsonResponse(
      { code: "DELETE_FAILED", message: "Account deletion failed." },
      502,
    );
  }
});
