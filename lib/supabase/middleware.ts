import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Refreshes the Supabase session (if needed) and returns both the response
 * carrying any updated auth cookies and the current user's verified JWT
 * claims (or null if unauthenticated). Called from the root `proxy.ts` on
 * every request so Server Components always see a fresh session.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!supabaseUrl || !supabaseAnonKey) {
    return { response, claims: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Triggers a token refresh (writing updated cookies via setAll above) and
  // returns locally-verified claims — do not remove this call, or sessions
  // will randomly appear expired.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}
