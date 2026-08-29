import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GitHubAnalysisRow } from "./types";

export async function getLatestGitHubAnalysis(userId: string): Promise<GitHubAnalysisRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("github_analyses")
    .select("*")
    .eq("profile_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as GitHubAnalysisRow) ?? null;
}
