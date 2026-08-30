"use server";

import { revalidatePath } from "next/cache";
import { buildVerifiedFacts } from "@/lib/application/verified-facts";
import { getOptionalUser } from "@/lib/auth/require-user";
import { ensureProfileExists } from "@/lib/career-profile/ensure-profile";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getDefaultResume } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyzeLinkedInContent, computeLinkedInContentHash, validatePastedContent } from "./analyze-linkedin";
import { generateLinkedInSection } from "./generate-content";
import { computeLinkedInScore } from "./score";
import type { LinkedInContentSection } from "./schemas";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function analyzeLinkedIn(
  pastedContent: string
): Promise<ActionResult & { analysisId?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const validation = validatePastedContent(pastedContent);
  if (!validation.valid) return { success: false, error: validation.reason };

  const contentHash = computeLinkedInContentHash(pastedContent);
  const supabase = await createServerSupabaseClient();
  await ensureProfileExists(user.id, supabase);

  const { data: existing } = await supabase
    .from("linkedin_analyses")
    .select("id")
    .eq("profile_id", user.id)
    .eq("content_hash", contentHash)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { success: true, analysisId: (existing as { id: string }).id };

  const [profile, resume] = await Promise.all([getCareerProfile(user.id), getDefaultResume(user.id)]);
  const targetRole = profile?.careerPreferences?.target_role ?? null;
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resume?.analysis?.skills.map((s) => s.name) ?? [];
  const candidateSkills = [...new Set([...profileSkills, ...resumeSkills])];

  let output;
  try {
    output = await analyzeLinkedInContent(pastedContent, targetRole, candidateSkills);
  } catch (error) {
    console.error("[linkedin] Analysis failed:", error instanceof Error ? error.message : String(error));
    return { success: false, error: "Couldn't analyze that right now. Try again." };
  }

  const { overall, breakdown } = computeLinkedInScore(output.findings);

  const { data: lastVersion } = await supabase
    .from("linkedin_analyses")
    .select("version_number")
    .eq("profile_id", user.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((lastVersion as { version_number: number } | null)?.version_number ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("linkedin_analyses")
    .insert({
      profile_id: user.id,
      content_hash: contentHash,
      version_number: nextVersion,
      category_scores: breakdown,
      overall_score: overall,
      findings: output.findings,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[linkedin] Saving analysis failed:", error?.message);
    return { success: false, error: "Analyzed it, but couldn't save the result. Try again." };
  }

  revalidatePath("/linkedin");
  return { success: true, analysisId: (inserted as { id: string }).id };
}

export async function generateLinkedInContentAction(
  section: LinkedInContentSection,
  analysisId?: string
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
    content = await generateLinkedInSection(section, facts);
  } catch (error) {
    console.error(
      "[linkedin] Content generation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't generate that right now. Try again." };
  }

  const supabase = await createServerSupabaseClient();
  await ensureProfileExists(user.id, supabase);
  const { error } = await supabase.from("linkedin_generated_content").insert({
    profile_id: user.id,
    linkedin_analysis_id: analysisId ?? null,
    section,
    content,
  });

  if (error) {
    console.error("[linkedin] Saving generated content failed:", error.message);
  }

  revalidatePath("/linkedin");
  return { success: true, content };
}
