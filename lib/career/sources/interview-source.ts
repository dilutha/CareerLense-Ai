import "server-only";
import { computeSessionSummary } from "@/lib/interview/session-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InterviewExchangeRow, InterviewSessionRow } from "@/lib/interview/types";

/** Overall answer-quality average from the candidate's most recent completed mock interview. */
export async function getInterviewReadinessScore(userId: string): Promise<number | null> {
  const supabase = await createServerSupabaseClient();
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("profile_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  const { data: exchanges } = await supabase
    .from("interview_exchanges")
    .select("*")
    .eq("session_id", (session as InterviewSessionRow).id);

  const summary = computeSessionSummary((exchanges ?? []) as InterviewExchangeRow[]);
  return summary.overall;
}
