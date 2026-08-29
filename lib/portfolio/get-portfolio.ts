import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PortfolioAnalysisRow, PortfolioGeneratedContentRow } from "./types";

export async function getLatestPortfolioAnalysis(userId: string): Promise<PortfolioAnalysisRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("portfolio_analyses")
    .select("*")
    .eq("profile_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PortfolioAnalysisRow) ?? null;
}

export async function getPortfolioHistory(userId: string): Promise<PortfolioAnalysisRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("portfolio_analyses")
    .select("*")
    .eq("profile_id", userId)
    .order("version_number", { ascending: false });

  return (data as PortfolioAnalysisRow[]) ?? [];
}

export async function getPortfolioGeneratedContent(userId: string): Promise<PortfolioGeneratedContentRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("portfolio_generated_content")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  return (data as PortfolioGeneratedContentRow[]) ?? [];
}
