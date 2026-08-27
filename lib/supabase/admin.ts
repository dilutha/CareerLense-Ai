import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * NOT used for ordinary authenticated CRUD — use
 * `createServerSupabaseClient()` from `./server` for that, so RLS stays
 * the source of truth for authorization. This client only exists for
 * carefully-controlled, privileged server-side operations, and nothing in
 * the codebase currently needs it (Phase 5's profile CRUD is done entirely
 * through the RLS-scoped server client).
 *
 * Lazily constructed so importing this module never throws just because
 * the service role key isn't configured — only calling it does.
 */
let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}
