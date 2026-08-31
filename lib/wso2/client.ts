import "server-only";
import { getWso2AccessToken, isWso2OAuth2Configured } from "./auth";
import { WSO2Error, type WSO2ErrorCategory } from "./errors";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_KEY_HEADER = "apikey";

/**
 * True when EITHER credential mode is usable: the production OAuth2
 * Client Credentials flow (auth.ts — preferred, checked first by
 * callWso2 below) or the legacy Developer Portal "Get Test Key" mode
 * (WSO2_API_KEY). Both remain supported simultaneously so switching one
 * env var set never breaks the other — see docs/WSO2_INTEGRATION.md §26.
 */
export function isWso2Configured(): boolean {
  return Boolean(process.env.WSO2_API_BASE_URL) && (isWso2OAuth2Configured() || Boolean(process.env.WSO2_API_KEY));
}

function requireBaseUrl(correlationId: string): string {
  const baseUrl = process.env.WSO2_API_BASE_URL;
  if (!baseUrl) throw new WSO2Error("CONFIG_ERROR", "WSO2_API_BASE_URL not set.", correlationId);
  return baseUrl;
}

function requireLegacyKeyConfig(correlationId: string): { apiKey: string; keyHeader: string } {
  const apiKey = process.env.WSO2_API_KEY;
  if (!apiKey) {
    throw new WSO2Error(
      "CONFIG_ERROR",
      "Neither WSO2 OAuth2 credentials (WSO2_TOKEN_URL/WSO2_CONSUMER_KEY/WSO2_CONSUMER_SECRET) nor the legacy WSO2_API_KEY are set.",
      correlationId
    );
  }
  return { apiKey, keyHeader: process.env.WSO2_API_KEY_HEADER?.trim() || DEFAULT_KEY_HEADER };
}

/** WSO2's own gateway-level error shape (confirmed live: `{"error_message":"Invalid Credentials","code":"900901",...}`) — distinct from this backend's `{success:false,error:{code,message}}` envelope, so a 401 can be told apart: rejected by the gateway itself vs. rejected by /api/v1 because the forwarded user bearer token was invalid. */
function isGatewayErrorShape(body: unknown): body is { code: string; error_message: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    "error_message" in body &&
    typeof (body as { code: unknown }).code === "string"
  );
}

function isBackendErrorShape(body: unknown): body is { success: false; error: { code: string; message: string } } {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { success?: unknown }).success === false &&
    typeof (body as { error?: unknown }).error === "object"
  );
}

/** Safe to log: correlation id, path, method, status, latency, which credential mode served the request — never the API key, the bearer token, or response bodies (which may carry PII). */
function logWso2Request(input: {
  correlationId: string;
  path: string;
  method: string;
  status: number | null;
  durationMs: number;
  category?: WSO2ErrorCategory;
}): void {
  const outcome = input.category ? ` category=${input.category}` : "";
  const mode = isWso2OAuth2Configured() ? "oauth2" : "legacy_test_key";
  console.log(
    `[wso2] ${input.correlationId} ${input.method} ${input.path} -> ${input.status ?? "ERR"} (${input.durationMs}ms) mode=${mode}${outcome}`
  );
}

export interface CallWso2Options {
  method?: "GET" | "PUT" | "POST" | "DELETE";
  /** The end-user's own Supabase access token — forwarded as Authorization: Bearer so /api/v1's OWN auth check (a second, independent layer from WSO2's gateway key) still resolves the real user. Omit for endpoints that need no user identity (e.g. /health). */
  userAccessToken?: string;
  body?: unknown;
  timeoutMs?: number;
  /** GET-only, single retry on a 5xx/network failure — never for a write. */
  retryOnFailure?: boolean;
}

/**
 * The one place this app calls out to the WSO2 API Platform gateway.
 * Two independent credentials travel on every request: the WSO2
 * subscription key (proves "this is the CareerLens server calling", the
 * API-consumer layer WSO2 itself is responsible for) and, when supplied,
 * the caller's own Supabase user access token (proves "this is a real,
 * specific signed-in user" — /api/v1's own bearer-auth check, unrelated
 * to and unaware of WSO2). See docs/WSO2_INTEGRATION.md for the full
 * two-layer explanation.
 */
export async function callWso2<T>(path: string, options: CallWso2Options = {}): Promise<T> {
  const correlationId = crypto.randomUUID();
  const method = options.method ?? "GET";
  const startedAt = Date.now();

  const baseUrl = requireBaseUrl(correlationId);
  const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "X-Correlation-ID": correlationId,
    Accept: "application/json",
  };

  if (isWso2OAuth2Configured()) {
    // Production mode: Authorization carries the WSO2 APPLICATION
    // identity (OAuth2 Client Credentials — see auth.ts). This is a
    // different identity than the end user, so the user's own Supabase
    // token can never also ride on Authorization here — it travels on
    // X-Supabase-Token instead, exactly like the legacy-mode fallback
    // below already does, and lib/api/auth.ts already accepts either
    // header as an equally-trusted, independently-reverified source.
    const appToken = await getWso2AccessToken();
    headers.Authorization = `Bearer ${appToken}`;
    if (options.userAccessToken) headers["X-Supabase-Token"] = options.userAccessToken;
  } else {
    // Legacy Developer Portal "Get Test Key" mode — unchanged from
    // before, kept working as long as WSO2_API_KEY is set, so adding
    // OAuth2 support never breaks whatever was already working.
    const { apiKey, keyHeader } = requireLegacyKeyConfig(correlationId);
    headers[keyHeader] = apiKey;
    if (options.userAccessToken) {
      // Sent BOTH ways — live-verified this session that WSO2 does not
      // reliably forward a client-supplied Authorization header through to
      // the backend (docs/WSO2_INTEGRATION.md §19-20), so the same token
      // also rides on X-Supabase-Token. Keeping Authorization too costs
      // nothing and keeps this working for any WSO2 config where it turns
      // out to pass through correctly.
      headers.Authorization = `Bearer ${options.userAccessToken}`;
      headers["X-Supabase-Token"] = options.userAccessToken;
    }
  }
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      const category: WSO2ErrorCategory = isAbort ? "TIMEOUT_ERROR" : "NETWORK_ERROR";
      logWso2Request({ correlationId, path, method, status: null, durationMs: Date.now() - startedAt, category });
      throw new WSO2Error(category, isAbort ? "Request timed out." : "Network error reaching WSO2.", correlationId);
    } finally {
      clearTimeout(timeout);
    }

    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      // Non-JSON body — parsed stays null, handled by the shape checks below.
    }

    if (!response.ok) {
      let category: WSO2ErrorCategory;
      if (isGatewayErrorShape(parsed)) {
        // WSO2's own rejection (invalid/missing subscription key, throttled, etc.)
        category = response.status === 429 ? "RATE_LIMIT_ERROR" : "AUTH_ERROR";
      } else if (isBackendErrorShape(parsed) && response.status === 401) {
        category = "UPSTREAM_UNAUTHORIZED";
      } else if (response.status === 429) {
        category = "RATE_LIMIT_ERROR";
      } else if (response.status >= 500) {
        category = "UPSTREAM_ERROR";
      } else {
        category = "VALIDATION_ERROR";
      }

      logWso2Request({ correlationId, path, method, status: response.status, durationMs: Date.now() - startedAt, category });
      const message = isGatewayErrorShape(parsed)
        ? parsed.error_message
        : isBackendErrorShape(parsed)
          ? parsed.error.message
          : `WSO2 request failed with status ${response.status}`;
      throw new WSO2Error(category, message, correlationId, response.status);
    }

    logWso2Request({ correlationId, path, method, status: response.status, durationMs: Date.now() - startedAt });

    if (!isBackendErrorShape(parsed) && typeof parsed === "object" && parsed !== null && "success" in parsed) {
      return parsed as T;
    }

    throw new WSO2Error("VALIDATION_ERROR", "Unexpected response shape from WSO2.", correlationId, response.status);
  };

  try {
    return await attempt();
  } catch (error) {
    const canRetry =
      options.retryOnFailure &&
      method === "GET" &&
      error instanceof WSO2Error &&
      (error.category === "UPSTREAM_ERROR" || error.category === "NETWORK_ERROR");
    if (!canRetry) throw error;
    return attempt();
  }
}
