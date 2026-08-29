import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { LinkedInAnalysisRow, LinkedInGeneratedContentRow } from "./types";

export async function getLatestLinkedInAnalysis(userId: string): Promise<LinkedInAnalysisRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("linkedin_analyses")
    .select("*")
    .eq("profile_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as LinkedInAnalysisRow) ?? null;
}

export async function getLinkedInGeneratedContent(userId: string): Promise<LinkedInGeneratedContentRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("linkedin_generated_content")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  return (data as LinkedInGeneratedContentRow[]) ?? [];
}
