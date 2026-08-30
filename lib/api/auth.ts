import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Identity model for /api/v1 (see docs/WSO2_API.md's "WSO2 vs Supabase
 * authentication responsibilities" section for the full explanation).
 *
 * There are deliberately TWO separate security layers, never conflated:
 *
 *   1. WSO2 authenticates the API CONSUMER (an application/client, via
 *      OAuth2 client-credentials or similar) — enforced entirely by the
 *      gateway, in front of this backend. This backend does not
 *      re-implement or verify WSO2's OAuth2 tokens at all; that's WSO2's
 *      job, not ours, and a WSO2-issued token proves "this is a
 *      legitimate registered application," never "this is a specific
 *      human."
 *   2. For any endpoint that touches a specific user's data, THIS
 *      backend separately requires a genuine Supabase-issued user access
 *      token, sent as `Authorization: Bearer <token>` OR the `X-Supabase-
 *      Token` header (the same JWT a Supabase client gets from a real
 *      sign-in — NOT the WSO2 OAuth2 token, and never a client-supplied
 *      user/profile id header, which Part 16 explicitly forbids
 *      trusting). This is the SAME Supabase Auth system the browser app
 *      already uses — just presented as a bearer token instead of a
 *      cookie, because a non-browser API client can't rely on cookies.
 *      The second header exists because WSO2 was live-verified NOT to
 *      forward a client-supplied `Authorization` header through to this
 *      backend (see docs/WSO2_INTEGRATION.md §19-20) — `lib/wso2/
 *      client.ts` sends the token both ways so whichever survives the
 *      gateway hop still authenticates correctly. Either way the token
 *      itself is independently re-verified against Supabase below —
 *      accepting it from an extra header never weakens this, since
 *      nothing is trusted without that verification.
 *
 * A route like GET /api/v1/health needs neither layer re-verified here
 * (WSO2 already gated who can reach the gateway route in production; the
 * backend endpoint itself carries no user data).
 */
export interface ApiAuthResult {
  userId: string;
  /** Bearer-token-authenticated client — every query through it is RLS-scoped to this user, exactly like the cookie-based server client, just via header instead of cookie. */
  supabase: SupabaseClient;
}

/**
 * Fallback header for the user's Supabase access token — live-verified
 * this session that WSO2 does NOT reliably forward a client-supplied
 * `Authorization` header through to this backend (the gateway's own
 * security scheme very plausibly treats that header name as reserved for
 * its own credential, even in API-Key mode — see docs/WSO2_INTEGRATION.md
 * §19-20 for the full evidence). `X-Supabase-Token` carries the exact
 * same value, just under a header name WSO2 has no reason to intercept.
 * Both are checked — `Authorization` still works for any caller that
 * doesn't go through WSO2 (e.g. a direct API client, or WSO2 configs
 * where it turns out to pass through fine after a Portal fix).
 */
const FALLBACK_TOKEN_HEADER = "x-supabase-token";

/** Exported for direct unit testing — pure header-parsing logic, no network. */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token.length > 0) return token;
  }

  const fallback = request.headers.get(FALLBACK_TOKEN_HEADER)?.trim();
  return fallback && fallback.length > 0 ? fallback : null;
}

/**
 * Verifies a Supabase user access token from the Authorization header.
 * Returns null (caller responds 401) rather than throwing — auth failure
 * is an expected, routine outcome for an API endpoint, not an exception.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const token = extractBearerToken(request);
  if (!token) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { userId: data.user.id, supabase };
}
