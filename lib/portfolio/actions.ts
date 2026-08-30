"use server";

import { revalidatePath } from "next/cache";
import { buildVerifiedFacts } from "@/lib/application/verified-facts";
import { getOptionalUser } from "@/lib/auth/require-user";
import { ensureProfileExists } from "@/lib/career-profile/ensure-profile";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getDefaultResume } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyzePortfolioContent } from "./analyze-portfolio";
import { computePortfolioContentHash, fetchAndExtractPortfolio } from "./extract";
import { generatePortfolioSection } from "./generate-content";
import { computePortfolioScore } from "./score";
import type { PortfolioContentSection } from "./schemas";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Analyzes a portfolio URL — reuses the existing analysis (no new Gemini
 * call, no new version) if the page's content hasn't changed since the
 * last run, unless `forceRefresh` is set. See PROJECT_SPEC.md's Phase 10
 * caching instruction.
 */
export async function analyzePortfolio(
  url: string,
  forceRefresh = false
): Promise<ActionResult & { analysisId?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const fetched = await fetchAndExtractPortfolio(url);
  if (!fetched.success) {
    return {
      success: false,
      error: `Machan portfolio eka direct read karanna bari una: ${fetched.reason} Portfolio eke About + Projects content tika paste karanna, mama eka analyze karannam.`,
    };
  }

  const contentHash = computePortfolioContentHash(url, fetched.content.visibleText);
  const supabase = await createServerSupabaseClient();
  await ensureProfileExists(user.id, supabase);

  if (!forceRefresh) {
    const { data: existing } = await supabase
      .from("portfolio_analyses")
      .select("id")
      .eq("profile_id", user.id)
      .eq("url", url)
      .eq("content_hash", contentHash)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { success: true, analysisId: (existing as { id: string }).id };
    }
  }

  const [profile, resume] = await Promise.all([getCareerProfile(user.id), getDefaultResume(user.id)]);
  const targetRole = profile?.careerPreferences?.target_role ?? null;
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resume?.analysis?.skills.map((s) => s.name) ?? [];
  const candidateSkills = [...new Set([...profileSkills, ...resumeSkills])];

  let output;
  try {
    output = await analyzePortfolioContent(fetched.content, targetRole, candidateSkills);
  } catch (error) {
    console.error(
      "[portfolio] Analysis failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't analyze that portfolio right now. Try again." };
  }

  const { overall, breakdown } = computePortfolioScore(output.findings);

  const { data: lastVersion } = await supabase
    .from("portfolio_analyses")
    .select("version_number")
    .eq("profile_id", user.id)
    .eq("url", url)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((lastVersion as { version_number: number } | null)?.version_number ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("portfolio_analyses")
    .insert({
      profile_id: user.id,
      url,
      content_hash: contentHash,
      version_number: nextVersion,
      seo_findings: fetched.content,
      category_scores: breakdown,
      overall_score: overall,
      findings: output.findings,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[portfolio] Saving analysis failed:", error?.message);
    return { success: false, error: "Analyzed it, but couldn't save the result. Try again." };
  }

  revalidatePath("/portfolio");
  return { success: true, analysisId: (inserted as { id: string }).id };
}

export async function generatePortfolioContentAction(
  section: PortfolioContentSection,
  analysisId?: string,
  extraInstruction?: string
): Promise<ActionResult & { content?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const [profile, resume] = await Promise.all([getCareerProfile(user.id), getDefaultResume(user.id)]);
  if (!profile && !resume) {
    return {
      success: false,
      error: "Complete your profile or upload a CV first so I have something real to write from.",
    };
  }

  const facts = buildVerifiedFacts(profile, resume?.version ?? null);

  let content: string;
  try {
    content = await generatePortfolioSection(section, facts, extraInstruction);
  } catch (error) {
    console.error(
      "[portfolio] Content generation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't generate that right now. Try again." };
  }

  const supabase = await createServerSupabaseClient();
  await ensureProfileExists(user.id, supabase);
  const { error } = await supabase.from("portfolio_generated_content").insert({
    profile_id: user.id,
    portfolio_analysis_id: analysisId ?? null,
    section,
    content,
  });

  if (error) {
    console.error("[portfolio] Saving generated content failed:", error.message);
    // Still return the content — losing the save shouldn't hide a real result.
  }

  revalidatePath("/portfolio");
  return { success: true, content };
}
