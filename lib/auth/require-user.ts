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
