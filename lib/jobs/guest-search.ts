import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { discoverJobs, type ProviderStatusEntry } from "./discovery";
import { computeJobMatch, type MatchCandidateInput, type MatchJobInput } from "./match";
import { rankJobs } from "./rank";
import type { JobSearchQuery } from "./providers/types";
import type { Job, JobMatch, JobSkillRow, JobWithMatch } from "./types";

/**
 * A guest's ephemeral candidate profile — built client-side from a
 * temporarily-parsed CV (never stored) or left empty for an unqualified
 * search. Never touches the `profiles`/`resumes` tables.
 */
export interface GuestCandidate {
  skills: string[];
  targetRole: string | null;
}

function buildGuestCandidateInput(candidate: GuestCandidate): MatchCandidateInput {
  return {
    profileSkills: [],
    resumeSkills: candidate.skills,
    targetRole: candidate.targetRole,
    educationDegrees: [],
    hasProfessionalExperience: false,
    projectCount: 0,
    preferredLocations: [],
    remotePreference: null,
  };
}

function buildGuestJobInput(job: Job, skills: JobSkillRow[]): MatchJobInput {
  const analysis = (job.normalized_data as { analysis?: { keywords?: string[]; experienceLevel?: string | null } })
    ?.analysis;

  return {
    title: job.title,
    location: job.location,
    workMode: job.work_mode,
    employmentType: job.employment_type,
    requiredSkills: skills.filter((s) => s.importance === "required").map((s) => s.skill_name),
    preferredSkills: skills.filter((s) => s.importance !== "required").map((s) => s.skill_name),
    keywords: analysis?.keywords ?? [],
    educationRequirements: job.requirements ? job.requirements.split("\n").slice(0, 5) : [],
    experienceLevel: analysis?.experienceLevel ?? null,
  };
}

function matchOneJobForGuest(job: Job, skills: JobSkillRow[], candidateInput: MatchCandidateInput): JobWithMatch {
  const result = computeJobMatch(candidateInput, buildGuestJobInput(job, skills));
  const now = new Date().toISOString();
  const match: JobMatch = {
    id: `guest-${job.id}`,
    profile_id: "guest",
    job_id: job.id,
    resume_id: null,
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
    created_at: now,
    updated_at: now,
  };
  return { job, skills, match };
}

/**
 * Matches a single already-stored job (e.g. one just imported from a
 * pasted URL — see analyze-url.ts) against a guest's ephemeral candidate,
 * without touching job_matches. Fetches that one job's skills the same
 * safe way searchJobsForGuest does.
 */
export async function matchJobForGuest(job: Job, candidate: GuestCandidate): Promise<JobWithMatch> {
  const supabase = getSupabaseAdminClient();
  const { data: skills } = await supabase.from("job_skills").select("*").eq("job_id", job.id);
  return matchOneJobForGuest(job, (skills ?? []) as JobSkillRow[], buildGuestCandidateInput(candidate));
}

export interface GuestSearchResult {
  results: JobWithMatch[];
  providerStatus: ProviderStatusEntry[];
}

/**
 * The same deterministic search+match pipeline as
 * lib/jobs/actions.ts#searchJobsCore, minus any database write — a guest
 * has no `profiles` row, so `matchAndCacheJobs`'s upsert into `job_matches`
 * (keyed by profile_id) isn't just unnecessary here, it would fail its FK
 * constraint. Matches are computed with the exact same `computeJobMatch`
 * engine and simply returned, never persisted or attributed to any user.
 */
export async function searchJobsForGuest(
  query: Partial<JobSearchQuery>,
  candidate: GuestCandidate
): Promise<GuestSearchResult> {
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
  const candidateInput = buildGuestCandidateInput(candidate);

  // job_skills is shared catalog data (no owner column, no per-user
  // scoping) gated to `authenticated` purely to deter anonymous scraping —
  // discoverJobs already returns the same jobs' full details to guests, so
  // reading their (also-shared) required-skill breakdown via the
  // service-role client here exposes nothing new. Never used for anything
  // owner-scoped.
  const supabase = getSupabaseAdminClient();
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

  const results = jobs.map((job) => matchOneJobForGuest(job, skillsByJob.get(job.id) ?? [], candidateInput));

  return { results: rankJobs(results), providerStatus };
}
