import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

/**
 * Cookie-aware, RLS-scoped Supabase client for Server Components, Server
 * Actions, and Route Handlers. Uses the public anon key — every query runs
 * as the currently-authenticated user (or anonymous), never bypassing RLS.
 *
 * Call this fresh in every server context that needs it — per the Supabase
 * SSR guidance, never share one instance across requests.
 *
 * Not parameterized with the hand-authored `Database` type — see the note
 * in client.ts. Query results are typed explicitly in lib/career-profile/.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  // Already validated above — TypeScript can't carry that narrowing into a
  // function declaration that closes over these module-level consts.
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component render, where cookies can't be
          // set. This is fine as long as `proxy.ts` also refreshes the
          // session — see lib/supabase/middleware.ts.
        }
      },
    },
  });
}
