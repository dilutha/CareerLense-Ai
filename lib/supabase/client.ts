import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

/**
 * Browser-safe Supabase client. Uses the public anon key and stores the
 * session in cookies (via @supabase/ssr) so server-rendered requests can
 * read the same session. Safe to import from Client Components.
 *
 * Not parameterized with the hand-authored `Database` type — it doesn't
 * match the structural contract supabase-js's generics expect (relationship
 * metadata, internal version markers). Query results are typed explicitly
 * at the call sites (lib/career-profile/) using the app's own types
 * instead. Regenerate lib/supabase/types.ts with the Supabase CLI once the
 * migration is applied and re-parameterize these clients if desired.
 */
export function createBrowserSupabaseClient() {
  // Already validated above — TypeScript can't carry that narrowing into a
  // function declaration that closes over these module-level consts.
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
