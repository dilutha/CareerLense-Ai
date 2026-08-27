import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { analyzeJob } from "./analyze-job";
import { deduplicateJobs } from "./deduplicate";
import { computeContentHash, validateNormalizedJob } from "./normalize";
import type { JobSearchProvider, JobSearchQuery, ProviderSearchResult } from "./providers/types";
import { getActiveProviders } from "./providers";
import type { NormalizedJob } from "./schemas";
import type { Job, JobSkillRow } from "./types";

export interface ProviderStatusEntry {
  provider: string;
  label: string;
  isDemo: boolean;
  status: ProviderSearchResult["status"];
  message?: string;
  resultCount: number;
}

export interface DiscoveryResult {
  jobs: Job[];
  providerStatus: ProviderStatusEntry[];
}

async function upsertJobs(normalizedJobs: NormalizedJob[]): Promise<Job[]> {
  if (normalizedJobs.length === 0) return [];

  const admin = getSupabaseAdminClient();
  const rows = normalizedJobs.map((job) => ({
    source: job.source,
    source_job_id: job.sourceJobId,
    title: job.title,
    company_name: job.company,
    location: job.location,
    country: job.country,
    employment_type: job.employmentType,
    work_mode: job.workMode,
    description: job.description,
    requirements: job.requirements.join("\n"),
    responsibilities: job.responsibilities.join("\n"),
    salary_text: job.salaryText,
    application_url: job.applicationUrl,
    source_url: job.sourceUrl,
    posted_at: job.postedAt,
    is_active: true,
    normalized_data: job,
    content_hash: computeContentHash(job),
  }));

  // The admin client isn't parameterized with a Database generic (see the
  // note in lib/supabase/client.ts) — supabase-js then infers `never` for
  // insert/upsert payloads rather than `any`, so the table accessor is
  // cast here at the single point where untyped rows are written.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from("jobs") as any)
    .upsert(rows, { onConflict: "content_hash" })
    .select("*");

  if (error) {
    console.error("[jobs] Upsert failed:", error.message);
    return [];
  }
  return (data ?? []) as Job[];
}

/**
 * Ensures every given job has cached skill analysis, calling Gemini only
 * for jobs that don't already have job_skills rows (content_hash-based
 * upsert means the same listing is never re-inserted, so this naturally
 * avoids re-analyzing unchanged jobs across searches).
 */
async function ensureJobsAnalyzed(jobs: Job[]): Promise<void> {
  if (jobs.length === 0) return;

  const admin = getSupabaseAdminClient();
  const { data: existing } = await admin
    .from("job_skills")
    .select("job_id")
    .in("job_id", jobs.map((j) => j.id));

  const analyzedJobIds = new Set((existing ?? []).map((row) => (row as { job_id: string }).job_id));
  const unanalyzed = jobs.filter((job) => !analyzedJobIds.has(job.id));

  await Promise.all(
    unanalyzed.map(async (job) => {
      const analysis = await analyzeJob(job);
      if (!analysis) return;

      const skillRows = analysis.skills.map((skill) => ({
        job_id: job.id,
        skill_name: skill.name,
        skill_type: skill.type,
        importance: skill.importance,
      }));

      if (skillRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("job_skills") as any).insert(skillRows);
      }

      if (analysis.experienceLevel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("jobs") as any)
          .update({ normalized_data: { ...(job.normalized_data ?? {}), analysis } })
          .eq("id", job.id);
      }
    })
  );
}

async function runProvider(
  provider: JobSearchProvider,
  query: JobSearchQuery
): Promise<ProviderSearchResult> {
  try {
    return await provider.search(query);
  } catch (error) {
    console.error(
      `[jobs] Provider "${provider.name}" threw:`,
      error instanceof Error ? error.message : String(error)
    );
    return {
      provider: provider.name,
      status: "error",
      jobs: [],
      message: "This source couldn't be checked right now.",
    };
  }
}

/**
 * Searches all active providers, normalizes/validates/deduplicates
 * results, upserts them into the shared `jobs` table (service-role,
 * trusted server-side code only — never client-writable), and ensures
 * each is skill-analyzed. One provider failing doesn't fail the whole
 * search — see providerStatus for partial-result transparency.
 */
export async function discoverJobs(query: JobSearchQuery): Promise<DiscoveryResult> {
  const providers = getActiveProviders();
  const results = await Promise.all(providers.map((provider) => runProvider(provider, query)));

  const allNormalized = results.flatMap((r) => r.jobs);
  const validated = allNormalized
    .map(validateNormalizedJob)
    .filter((j): j is NormalizedJob => j !== null);
  const deduped = deduplicateJobs(validated);

  const stored = await upsertJobs(deduped);
  await ensureJobsAnalyzed(stored);

  const providerStatus: ProviderStatusEntry[] = providers.map((provider, i) => ({
    provider: provider.name,
    label: provider.label,
    isDemo: provider.isDemo,
    status: results[i].status,
    message: results[i].message,
    resultCount: results[i].jobs.length,
  }));

  return { jobs: stored, providerStatus };
}

export type { JobSkillRow };
