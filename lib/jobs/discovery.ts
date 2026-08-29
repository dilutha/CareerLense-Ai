import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { analyzeJob } from "./analyze-job";
import { findCanonicalDuplicate } from "./cross-source-dedupe";
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
  const nowIso = new Date().toISOString();
  const rows = normalizedJobs.map((job) => ({
    source: job.source,
    source_name: job.sourceName,
    source_type: job.sourceType,
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
    // first_seen_at deliberately omitted — the column's own DEFAULT now()
    // sets it on INSERT, and omitting it from the upsert payload means an
    // ON CONFLICT UPDATE leaves the original value untouched (Postgres
    // only overwrites columns explicitly included in the SET clause).
    last_seen_at: nowIso,
    listing_status: "active",
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
 * Links newly-stored jobs to an existing job from a DIFFERENT source when
 * confidently the same real-world vacancy (see cross-source-dedupe.ts).
 * Runs after storage, never deletes a row — both keep existing, one just
 * gains a duplicate_of pointer so the UI can say "also listed on X".
 */
async function linkCrossSourceDuplicates(jobs: Job[]): Promise<void> {
  const admin = getSupabaseAdminClient();

  for (const job of jobs) {
    if (job.duplicate_of) continue; // already linked from a prior run

    const company = (job.company_name ?? "").trim();
    if (!company) continue;

    // Scope the comparison set — never scan the whole table. ilike on a
    // short prefix of the company name is enough to catch the "(Pvt) Ltd"
    // suffix variance without a full table scan.
    const prefix = company.slice(0, Math.min(6, company.length));
    const { data: candidates } = await admin
      .from("jobs")
      .select("*")
      .neq("source", job.source)
      .ilike("company_name", `%${prefix}%`)
      .limit(25);

    const match = findCanonicalDuplicate(
      {
        source: job.source,
        title: job.title,
        company: job.company_name,
        location: job.location,
        applicationUrl: job.application_url,
      },
      (candidates ?? []) as Job[]
    );

    if (match) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("jobs") as any).update({ duplicate_of: match.id }).eq("id", job.id);
    }
  }
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
 * Records one ingestion attempt per provider (job_source_runs) and syncs
 * job_sources' live health fields — pure observability, safe to fail
 * silently (never blocks the actual search if this logging has an issue).
 * jobs_added is a best-effort count of that provider's validated jobs that
 * made it into the final stored batch (identified by content_hash) — this
 * doesn't distinguish a genuinely new row from one that already existed
 * and was just refreshed, which would need a second round-trip to check;
 * not worth it for what's fundamentally debugging metadata.
 */
async function recordSourceRuns(
  providers: JobSearchProvider[],
  results: ProviderSearchResult[],
  storedHashes: Set<string>,
  startedAt: string
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const completedAt = new Date().toISOString();

  await Promise.all(
    providers.map(async (provider, i) => {
      const result = results[i];
      const validated = result.jobs
        .map(validateNormalizedJob)
        .filter((j): j is NormalizedJob => j !== null);
      const added = validated.filter((j) => storedHashes.has(computeContentHash(j))).length;

      const runStatus = result.status === "ok" ? "success" : result.status === "error" ? "failed" : "partial";

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("job_source_runs") as any).insert({
          source_key: provider.name,
          started_at: startedAt,
          completed_at: completedAt,
          status: runStatus,
          jobs_found: result.jobs.length,
          jobs_added: added,
          jobs_updated: 0,
          jobs_failed: result.jobs.length - validated.length,
          error_summary: result.message ?? null,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("job_sources") as any)
          .update({
            status: result.status === "ok" ? "available" : result.status,
            ...(result.status === "ok" ? { last_successful_run_at: completedAt } : {}),
            last_error: result.status === "ok" ? null : (result.message ?? "Unknown error"),
          })
          .eq("key", provider.name);
      } catch (error) {
        // Observability logging must never break a real search.
        console.error("[jobs] Failed to record source run:", error instanceof Error ? error.message : error);
      }
    })
  );
}

/**
 * Searches all active providers, normalizes/validates/deduplicates
 * results, upserts them into the shared `jobs` table (service-role,
 * trusted server-side code only — never client-writable), links
 * cross-source duplicates, and ensures each is skill-analyzed. One
 * provider failing doesn't fail the whole search — see providerStatus for
 * partial-result transparency.
 */
export async function discoverJobs(query: JobSearchQuery): Promise<DiscoveryResult> {
  const startedAt = new Date().toISOString();
  const providers = getActiveProviders();
  const results = await Promise.all(providers.map((provider) => runProvider(provider, query)));

  const allNormalized = results.flatMap((r) => r.jobs);
  const validated = allNormalized
    .map(validateNormalizedJob)
    .filter((j): j is NormalizedJob => j !== null);
  const deduped = deduplicateJobs(validated);

  const stored = await upsertJobs(deduped);
  await Promise.all([
    linkCrossSourceDuplicates(stored),
    ensureJobsAnalyzed(stored),
    recordSourceRuns(providers, results, new Set(stored.map((j) => j.content_hash)), startedAt),
  ]);

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

/**
 * Stores and analyzes a single job the user supplied directly (e.g. a
 * pasted LinkedIn/company URL that resolved via importJobFromUrl) — the
 * same storage + skill-analysis steps discoverJobs() runs for a whole
 * search batch, just for one job. Not cross-source-deduplicated against
 * (a single user-supplied job is unlikely to already exist under a
 * different source, and if it does, the content_hash upsert plus the
 * user's own view of "already saved" is enough).
 */
export async function storeImportedJob(job: NormalizedJob): Promise<Job | null> {
  const validated = validateNormalizedJob(job);
  if (!validated) return null;

  const stored = await upsertJobs([validated]);
  if (stored.length === 0) return null;

  await ensureJobsAnalyzed(stored);
  return stored[0];
}

export type { JobSkillRow };
