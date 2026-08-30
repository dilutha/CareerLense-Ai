import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

/**
 * Server-side auth guard for protected pages. `proxy.ts` already redirects
 * unauthenticated requests at the edge, but Next.js explicitly recommends
 * not relying on that alone — each protected Server Component re-verifies
 * here too.
 *
 * Redirects to `/login?next=<path>` if there's no valid session, otherwise
 * returns the authenticated user's id (never trust a client-supplied id
 * for authorization — this is always derived from the verified session).
 */
export async function requireUser(currentPath: string): Promise<AuthenticatedUser> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
}

/** Like requireUser, but returns null instead of redirecting. */
export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) return null;

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
}

/**
 * The raw Supabase access token JWT for the current cookie session — not
 * for identity verification (getClaims()/requireUser() already do that);
 * this is only for forwarding as a bearer token to a non-browser caller
 * of /api/v1, e.g. lib/wso2/client.ts, which needs the literal token
 * string to prove to /api/v1's OWN auth check which real user this is.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
