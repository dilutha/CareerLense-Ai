import "server-only";
import { WSO2Error, type WSO2ErrorCategory } from "./errors";

/**
 * WSO2 OAuth2 Client Credentials — obtains an access token that
 * identifies the CareerLens APPLICATION to WSO2 (never a specific end
 * user; see client.ts's header comment for the full two-identity model).
 * This is the production credential mechanism, replacing the Developer
 * Portal's short-lived "Get Test Key" flow (docs/WSO2_INTEGRATION.md
 * §21/§23/§24 — that credential kept expiring mid-session by design).
 *
 * Additive, not a replacement: `callWso2` (client.ts) uses this mode only
 * when WSO2_TOKEN_URL/WSO2_CONSUMER_KEY/WSO2_CONSUMER_SECRET are all set;
 * otherwise it falls back to the existing WSO2_API_KEY header mode
 * unchanged, so nothing that already worked stops working.
 */

const TOKEN_REQUEST_TIMEOUT_MS = 10_000;
/** Refresh this long before the token's real expiry — never cut it razor-thin against clock skew or request latency. */
const EXPIRY_SAFETY_MARGIN_MS = 30_000;
/** WSO2 access tokens are commonly ~3600s; used only if the token response omits expires_in. */
const DEFAULT_TTL_SECONDS = 3600;

export function isWso2OAuth2Configured(): boolean {
  return Boolean(process.env.WSO2_TOKEN_URL && process.env.WSO2_CONSUMER_KEY && process.env.WSO2_CONSUMER_SECRET);
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let inFlight: Promise<string> | null = null;

async function fetchNewToken(): Promise<CachedToken> {
  const tokenUrl = process.env.WSO2_TOKEN_URL;
  const consumerKey = process.env.WSO2_CONSUMER_KEY;
  const consumerSecret = process.env.WSO2_CONSUMER_SECRET;
  const correlationId = crypto.randomUUID();

  if (!tokenUrl || !consumerKey || !consumerSecret) {
    throw new WSO2Error("CONFIG_ERROR", "WSO2 OAuth2 credentials are not configured.", correlationId);
  }

  // Basic auth per RFC 6749 §2.3.1 — built here, never logged, never
  // returned to any caller.
  const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: controller.signal,
    });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const category: WSO2ErrorCategory = isAbort ? "TIMEOUT_ERROR" : "NETWORK_ERROR";
    console.log(`[wso2-oauth2] ${correlationId} POST /oauth2/token -> ERR (${category})`);
    throw new WSO2Error(category, "Failed to reach the WSO2 token endpoint.", correlationId);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Deliberately never reads/logs the response body here — an OAuth2
    // error body can legally echo back request parameters, and the
    // consumer key (not secret) sometimes appears in such payloads.
    // Status + category is enough to diagnose from this app's own logs.
    console.log(`[wso2-oauth2] ${correlationId} POST /oauth2/token -> ${response.status}`);
    throw new WSO2Error("AUTH_ERROR", `WSO2 OAuth2 token request failed (HTTP ${response.status}).`, correlationId, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new WSO2Error("VALIDATION_ERROR", "WSO2 token endpoint returned a non-JSON response.", correlationId);
  }

  const accessToken = (body as { access_token?: unknown })?.access_token;
  const expiresIn = (body as { expires_in?: unknown })?.expires_in;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new WSO2Error("VALIDATION_ERROR", "WSO2 token endpoint response had no access_token.", correlationId);
  }

  console.log(`[wso2-oauth2] ${correlationId} POST /oauth2/token -> 200 (token obtained)`);
  const ttlSeconds = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : DEFAULT_TTL_SECONDS;
  return { accessToken, expiresAt: Date.now() + ttlSeconds * 1000 - EXPIRY_SAFETY_MARGIN_MS };
}

/**
 * Returns a cached, still-valid WSO2 application access token, fetching
 * or refreshing one only when the cache is empty/expired — never on
 * every call. Concurrent callers during a refresh share one in-flight
 * request rather than each starting their own.
 */
export async function getWso2AccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
  if (inFlight) return inFlight;

  inFlight = fetchNewToken()
    .then((token) => {
      cached = token;
      return token.accessToken;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Test-only — resets the module-level cache between test cases. Not used by application code. */
export function __resetWso2TokenCacheForTests(): void {
  cached = null;
  inFlight = null;
}
