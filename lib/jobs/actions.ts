"use server";

import { revalidatePath } from "next/cache";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";
import { CAREERLENS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getDefaultResume } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { discoverJobs, type ProviderStatusEntry } from "./discovery";
import { getJobWithMatch } from "./get-jobs";
import { computeJobMatch, type MatchCandidateInput, type MatchJobInput } from "./match";
import { rankJobs } from "./rank";
import type { JobSearchQuery } from "./providers/types";
import type { Job, JobMatch, JobSkillRow, JobWithMatch } from "./types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

function buildCandidateInput(
  profile: Awaited<ReturnType<typeof getCareerProfile>>,
  resume: Awaited<ReturnType<typeof getDefaultResume>>
): MatchCandidateInput {
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resume?.analysis?.skills.map((s) => s.name) ?? [];

  return {
    profileSkills,
    resumeSkills,
    targetRole: profile?.careerPreferences?.target_role ?? null,
    educationDegrees:
      profile?.education.map((e) => [e.degree, e.field_of_study].filter(Boolean).join(" ")) ?? [],
    hasProfessionalExperience: (profile?.experience.length ?? 0) > 0,
    projectCount: (profile?.projects.length ?? 0) + (resume?.analysis?.projects.length ?? 0),
    preferredLocations: profile?.careerPreferences?.preferred_locations ?? [],
    remotePreference: profile?.careerPreferences?.remote_preference ?? null,
  };
}

function buildJobInput(job: Job, skills: JobSkillRow[]): MatchJobInput {
  const analysis = (job.normalized_data as { analysis?: { keywords?: string[]; experienceLevel?: string | null } })
    ?.analysis;

  return {
    title: job.title,
    location: job.location,
    workMode: job.work_mode,
    employmentType: job.employment_type,
    requiredSkills: skills.filter((s) => s.importance === "required").map((s) => s.skill_name),
    preferredSkills: skills
      .filter((s) => s.importance !== "required")
      .map((s) => s.skill_name),
    keywords: analysis?.keywords ?? [],
    educationRequirements: job.requirements ? job.requirements.split("\n").slice(0, 5) : [],
    experienceLevel: analysis?.experienceLevel ?? null,
  };
}

async function matchAndCacheJobs(
  userId: string,
  jobs: Job[],
  resumeId: string | null
): Promise<JobWithMatch[]> {
  if (jobs.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const [profile, resume] = await Promise.all([getCareerProfile(userId), getDefaultResume(userId)]);
  const candidate = buildCandidateInput(profile, resume);

  const { data: allSkills } = await supabase
    .from("job_skills")
    .select("*")
    .in("job_id", jobs.map((j) => j.id));

  const skillsByJob = new Map<string, JobSkillRow[]>();
  for (const row of (allSkills ?? []) as JobSkillRow[]) {
    const list = skillsByJob.get(row.job_id) ?? [];
    list.push(row);
    skillsByJob.set(row.job_id, list);
  }

  const results: JobWithMatch[] = [];

  for (const job of jobs) {
    const jobSkills = skillsByJob.get(job.id) ?? [];
    const result = computeJobMatch(candidate, buildJobInput(job, jobSkills));

    const matchRow = {
      profile_id: userId,
      job_id: job.id,
      resume_id: resumeId,
      match_score: result.overall,
      skills_score: result.skillsScore,
      role_score: result.roleScore,
      experience_score: result.experienceScore,
      education_score: result.educationScore,
      location_score: result.locationScore,
      keyword_score: result.keywordScore,
      matched_skills: result.matchedSkills,
      missing_required_skills: result.missingRequiredSkills,
      missing_preferred_skills: result.missingPreferredSkills,
      matched_keywords: result.matchedKeywords,
      missing_keywords: result.missingKeywords,
      explanation: result.explanation,
    };

    const { data: saved } = await supabase
      .from("job_matches")
      .upsert(matchRow, { onConflict: "profile_id,job_id" })
      .select("*")
      .single();

    results.push({ job, skills: jobSkills, match: (saved as JobMatch) ?? null });
  }

  return results;
}

export interface SearchJobsResult {
  results: JobWithMatch[];
  providerStatus: ProviderStatusEntry[];
}

export async function searchJobsForCurrentUser(
  query: Partial<JobSearchQuery>
): Promise<SearchJobsResult | { error: string }> {
  const user = await getOptionalUser();
  if (!user) return { error: "Please log in again." };

  const fullQuery: JobSearchQuery = {
    role: query.role ?? null,
    location: query.location ?? null,
    country: query.country ?? "Sri Lanka",
    level: query.level ?? null,
    workMode: query.workMode ?? null,
    keywords: query.keywords ?? [],
    limit: query.limit ?? 20,
  };

  const { jobs, providerStatus } = await discoverJobs(fullQuery);
  const resume = await getDefaultResume(user.id);
  const matched = await matchAndCacheJobs(user.id, jobs, resume?.resume.id ?? null);

  return { results: rankJobs(matched), providerStatus };
}

export async function saveJob(jobId: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("saved_jobs")
    .insert({ profile_id: user.id, job_id: jobId });

  if (error && error.code !== "23505") {
    return { success: false, error: "Couldn't save that job." };
  }
  revalidatePath("/jobs");
  revalidatePath("/jobs/saved");
  return { success: true };
}

export async function unsaveJob(jobId: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("saved_jobs")
    .delete()
    .eq("profile_id", user.id)
    .eq("job_id", jobId);

  if (error) return { success: false, error: "Couldn't remove that job." };
  revalidatePath("/jobs");
  revalidatePath("/jobs/saved");
  return { success: true };
}

/**
 * A short, friendly explanation of one already-computed match — used by
 * the "Why does this match?" button on a job card. Never recomputes the
 * score with Gemini; only narrates the deterministic result that's
 * already cached in job_matches, and only for the requesting user's own
 * match (ownership enforced by both the jobId+userId query and RLS).
 */
export async function explainJobMatch(
  jobId: string
): Promise<ActionResult & { explanation?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const result = await getJobWithMatch(user.id, jobId);
  if (!result?.match) {
    return { success: false, error: "No match found for that job yet." };
  }

  const { job, match } = result;

  try {
    const ai = getGeminiClient();
    const prompt = `The user tapped "why does this match?" on a job card. Explain their ${match.match_score}% match for "${job.title}"${job.company_name ? ` at ${job.company_name}` : ""} in 2-4 short sentences, friendly and direct — no fabricated details, only what's below.

Matched: ${match.matched_skills.join(", ") || "none listed"}
Missing required: ${match.missing_required_skills.join(", ") || "none"}
Missing preferred: ${match.missing_preferred_skills.join(", ") || "none"}
Score breakdown — skills ${match.skills_score}, role fit ${match.role_score}, experience ${match.experience_score}, education ${match.education_score}, location ${match.location_score}, keywords ${match.keyword_score}.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { systemInstruction: CAREERLENS_SYSTEM_PROMPT, temperature: 0.6 },
    });

    const text = response.text;
    if (!text) return { success: false, error: "Couldn't generate an explanation right now." };
    return { success: true, explanation: text };
  } catch (error) {
    console.error(
      "[jobs] explainJobMatch failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't generate an explanation right now." };
  }
}
