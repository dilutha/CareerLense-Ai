import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Defensive safety net for a real bug found live: `handle_new_user()`
 * (migration 001) is supposed to create a `profiles` row for every new
 * `auth.users` row, but at least one real account exists with none —
 * `resumes`/`education`/`experience`/`projects`/`profile_skills`/
 * `portfolio_analyses`/`github_analyses` all have a `not null references
 * profiles(id)` foreign key, so any insert for that user fails outright.
 * That's the exact root cause of "Couldn't save that resume. Try again."
 * and "Analyzed it, but couldn't save the result. Try again." — the
 * extraction/analysis itself succeeded; only the FK-dependent save failed.
 *
 * Idempotent, RLS-respecting (relies on `profiles_insert_own`'s
 * `auth.uid() = id` check via the caller's own RLS-scoped client — never
 * the service-role client), and cheap (`on conflict do nothing`, no
 * pre-read). Call this before any insert into a table that FKs to
 * `profiles(id)`, instead of assuming the signup trigger already ran.
 */
export async function ensureProfileExists(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    console.error("ensureProfileExists: upsert failed", error);
  }
}
