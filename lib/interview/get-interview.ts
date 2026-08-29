import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InterviewExchangeRow, InterviewSessionRow, InterviewSessionWithExchanges } from "./types";

export async function getInterviewSession(
  userId: string,
  sessionId: string
): Promise<InterviewSessionWithExchanges | null> {
  const supabase = await createServerSupabaseClient();

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!session) return null;

  const { data: exchanges } = await supabase
    .from("interview_exchanges")
    .select("*")
    .eq("session_id", sessionId)
    .eq("profile_id", userId)
    .order("order_index", { ascending: true });

  return {
    session: session as InterviewSessionRow,
    exchanges: (exchanges ?? []) as InterviewExchangeRow[],
  };
}

export async function getInterviewSessionsForUser(userId: string): Promise<InterviewSessionRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []) as InterviewSessionRow[];
}
