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
 *      token, sent as `Authorization: Bearer <token>` (the same JWT a
 *      Supabase client gets from a real sign-in — NOT the WSO2 OAuth2
 *      token, and never a client-supplied user/profile id header, which
 *      Part 16 explicitly forbids trusting). This is the SAME
 *      Supabase Auth system the browser app already uses — just
 *      presented as a bearer token instead of a cookie, because a
 *      non-browser API client can't rely on cookies.
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

/** Exported for direct unit testing — pure header-parsing logic, no network. */
export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
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
