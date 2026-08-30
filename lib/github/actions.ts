"use server";

import { revalidatePath } from "next/cache";
import { getOptionalUser } from "@/lib/auth/require-user";
import { ensureProfileExists } from "@/lib/career-profile/ensure-profile";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { populateProfileFromSkillsAndProjects } from "@/lib/career-profile/populate-from-resume";
import { getDefaultResume } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyzeGitHubProfile } from "./analyze-github";
import { computeGitHubContentHash, fetchGitHubProfile, parseGitHubUsername } from "./github-api";
import { computeGitHubScore } from "./score";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function analyzeGitHub(
  usernameOrUrl: string,
  forceRefresh = false
): Promise<ActionResult & { analysisId?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const username = parseGitHubUsername(usernameOrUrl);
  if (!username) {
    return { success: false, error: "That doesn't look like a valid GitHub username or URL." };
  }

  const fetched = await fetchGitHubProfile(username);
  if (!fetched.success) {
    return { success: false, error: fetched.reason };
  }

  const contentHash = computeGitHubContentHash(fetched.profile);
  const supabase = await createServerSupabaseClient();
  await ensureProfileExists(user.id, supabase);

  if (!forceRefresh) {
    const { data: existing } = await supabase
      .from("github_analyses")
      .select("id")
      .eq("profile_id", user.id)
      .eq("github_username", username)
      .eq("content_hash", contentHash)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return { success: true, analysisId: (existing as { id: string }).id };
  }

  const [profile, resume] = await Promise.all([getCareerProfile(user.id), getDefaultResume(user.id)]);
  const targetRole = profile?.careerPreferences?.target_role ?? null;
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resume?.analysis?.skills.map((s) => s.name) ?? [];
  const candidateSkills = [...new Set([...profileSkills, ...resumeSkills])];

  let output;
  try {
    output = await analyzeGitHubProfile(fetched.profile, targetRole, candidateSkills);
  } catch (error) {
    console.error("[github] Analysis failed:", error instanceof Error ? error.message : String(error));
    return { success: false, error: "Couldn't analyze that GitHub profile right now. Try again." };
  }

  const { overall, breakdown } = computeGitHubScore(output.findings);

  const { data: lastVersion } = await supabase
    .from("github_analyses")
    .select("version_number")
    .eq("profile_id", user.id)
    .eq("github_username", username)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((lastVersion as { version_number: number } | null)?.version_number ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("github_analyses")
    .insert({
      profile_id: user.id,
      github_username: username,
      content_hash: contentHash,
      version_number: nextVersion,
      category_scores: breakdown,
      overall_score: overall,
      findings: output.findings,
      recommended_projects: output.recommendedProjects,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[github] Saving analysis failed:", error?.message);
    return { success: false, error: "Analyzed it, but couldn't save the result. Try again." };
  }

  // Best-effort — languages GitHub itself reports per repo are a reliable
  // structured signal ("X appears in your public GitHub projects", never
  // "professional X developer" per Part 4); repo name/description become
  // project entries. No extra Gemini call — this is the same repos list
  // already fetched above.
  try {
    const languages = [...new Set(fetched.profile.repos.map((r) => r.language).filter((l): l is string => Boolean(l)))];
    await populateProfileFromSkillsAndProjects(
      supabase,
      user.id,
      {
        skills: languages.map((name) => ({ name, category: "programming" })),
        projects: fetched.profile.repos
          .filter((r) => !r.isFork)
          .map((r) => ({ name: r.name, description: r.description })),
      },
      "github"
    );
  } catch (populateError) {
    console.error(
      "[github] Profile auto-population failed:",
      populateError instanceof Error ? populateError.message : String(populateError)
    );
  }

  revalidatePath("/github");
  return { success: true, analysisId: (inserted as { id: string }).id };
}
