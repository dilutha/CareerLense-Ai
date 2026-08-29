import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const RECENT_MATCHES_LIMIT = 10;

/**
 * "Skills" readiness — averaged skills_score across the candidate's most
 * recent deterministic job matches (lib/jobs/match.ts), a genuine
 * already-computed signal rather than a new ad-hoc heuristic. Null if the
 * candidate hasn't matched against any job yet.
 */
export async function getSkillsReadinessScore(userId: string): Promise<number | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("job_matches")
    .select("skills_score")
    .eq("profile_id", userId)
    .not("skills_score", "is", null)
    .order("updated_at", { ascending: false })
    .limit(RECENT_MATCHES_LIMIT);

  const rows = (data ?? []) as { skills_score: number }[];
  if (rows.length === 0) return null;

  return Math.round(rows.reduce((sum, r) => sum + r.skills_score, 0) / rows.length);
}
