import "server-only";
import { z } from "zod";
import { getSerpApiKey } from "../../env";
import { parseRelativeDate } from "../relative-date";
import { expandSearchQueries, resolveSearchLocation } from "../query-expansion";
import { NormalizedJobSchema, type NormalizedJob } from "../schemas";
import type { JobSearchProvider, JobSearchQuery, ProviderSearchResult } from "./types";

/**
 * SerpApi's Google Jobs API — the primary broad/worldwide discovery
 * provider (Phase 10A). Confirmed this session directly against SerpApi's
 * own documentation (not guessed):
 *
 *   GET https://serpapi.com/search?engine=google_jobs&q=...&api_key=...
 *
 * Optional params actually documented: location, gl (country code), hl
 * (language code), google_domain, next_page_token. `chips`/`ltype` (date-
 * posted / remote filters) are marked DEPRECATED BY GOOGLE in SerpApi's
 * own docs — deliberately not used here; freshness/remote signals are
 * instead read from each result's own fields client-side (see below).
 *
 * `jobs_results[].apply_options` is how SerpApi exposes per-source apply
 * links (e.g. a LinkedIn entry, an Indeed entry, sometimes the employer's
 * own site) — this is the real per-job application URL, not Google's own
 * tracking link. Whether a given apply_options entry always resolves to
 * the true original poster isn't guaranteed by SerpApi's docs, so every
 * SerpApi-sourced job is conservatively labeled sourceType
 * "aggregator_result" regardless of the underlying site — never
 * "official_company", since that can't be verified without an extra
 * fetch per result (which would also multiply cost against a metered API).
 */

const SERPAPI_BASE = "https://serpapi.com/search";
const REQUEST_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { fetchedAt: number; results: SerpApiJobResult[] }>();

const SerpApiApplyOptionSchema = z.object({
  title: z.string().optional(),
  link: z.string().optional(),
});

const SerpApiJobResultSchema = z.object({
  title: z.string(),
  company_name: z.string().optional(),
  location: z.string().optional(),
  via: z.string().optional(),
  description: z.string().optional(),
  job_id: z.string().optional(),
  share_link: z.string().optional(),
  apply_options: z.array(SerpApiApplyOptionSchema).optional(),
  detected_extensions: z
    .object({
      posted_at: z.string().optional(),
      schedule_type: z.string().optional(),
      salary: z.string().optional(),
    })
    .optional(),
});
type SerpApiJobResult = z.infer<typeof SerpApiJobResultSchema>;

const SerpApiResponseSchema = z.object({
  jobs_results: z.array(z.unknown()).optional(),
  error: z.string().optional(),
});

function isHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const EMPLOYMENT_TYPE_MAP: Record<string, NormalizedJob["employmentType"]> = {
  internship: "internship",
  "part-time": "part_time",
  parttime: "part_time",
  "full-time": "full_time",
  fulltime: "full_time",
  contractor: "contract",
  contract: "contract",
  temporary: "contract",
};

function inferEmploymentType(scheduleType: string | undefined): NormalizedJob["employmentType"] {
  if (!scheduleType) return null;
  return EMPLOYMENT_TYPE_MAP[scheduleType.toLowerCase().trim()] ?? null;
}

function inferWorkMode(text: string): NormalizedJob["workMode"] {
  const lower = text.toLowerCase();
  if (/\bremote\b/.test(lower)) return "remote";
  if (/\bhybrid\b/.test(lower)) return "hybrid";
  return null;
}

/**
 * Pure normalization — separated from the fetch for direct unit testing
 * against real-shaped and malformed responses (same pattern as
 * lib/jobs/providers/itpro.ts#toNormalizedJob).
 */
export function normalizeSerpApiJob(raw: SerpApiJobResult): NormalizedJob | null {
  const applyOption = raw.apply_options?.find((o) => isHttpsUrl(o.link));
  const applicationUrl = applyOption?.link ?? (isHttpsUrl(raw.share_link) ? raw.share_link : null);
  if (!applicationUrl) return null; // No safe, real application link — never fabricate one.

  const sourceName = applyOption?.title ?? raw.via?.replace(/^via\s+/i, "") ?? null;
  const combinedText = `${raw.location ?? ""} ${raw.description ?? ""}`;

  const candidate = {
    source: "serpapi",
    sourceName,
    sourceType: "aggregator_result" as const,
    sourceJobId: raw.job_id ?? null,
    title: raw.title,
    company: raw.company_name ?? null,
    location: raw.location ?? null,
    country: "Sri Lanka", // overwritten by the caller per-search when a different country was requested
    employmentType: inferEmploymentType(raw.detected_extensions?.schedule_type),
    workMode: inferWorkMode(combinedText),
    description: raw.description ?? null,
    responsibilities: [],
    requirements: [],
    salaryText: raw.detected_extensions?.salary ?? null,
    postedAt: raw.detected_extensions?.posted_at ? parseRelativeDate(raw.detected_extensions.posted_at) : null,
    applicationUrl,
    sourceUrl: isHttpsUrl(raw.share_link) ? raw.share_link : applicationUrl,
  };

  const result = NormalizedJobSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

async function fetchOneQuery(
  q: string,
  location: string | null,
  country: string,
  apiKey: string
): Promise<{ status: ProviderSearchResult["status"]; results: SerpApiJobResult[]; message?: string }> {
  const cacheKey = `${q}|${location ?? ""}|${country}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { status: "ok", results: cached.results };
  }

  const params = new URLSearchParams({
    engine: "google_jobs",
    q,
    api_key: apiKey,
    hl: "en",
  });
  if (location) params.set("location", location);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SERPAPI_BASE}?${params.toString()}`, { signal: controller.signal });

    if (response.status === 401 || response.status === 403) {
      return { status: "blocked", results: [], message: "SerpApi authentication failed." };
    }
    if (response.status === 429) {
      return { status: "rate_limited", results: [], message: "SerpApi rate limit reached." };
    }
    if (!response.ok) {
      return { status: "error", results: [], message: `SerpApi responded with status ${response.status}.` };
    }

    const json: unknown = await response.json();
    const parsed = SerpApiResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { status: "error", results: [], message: "SerpApi returned an unexpected response shape." };
    }
    if (parsed.data.error) {
      return { status: "error", results: [], message: "SerpApi reported an error for this query." };
    }

    const validResults = (parsed.data.jobs_results ?? [])
      .map((r) => SerpApiJobResultSchema.safeParse(r))
      .filter((r): r is { success: true; data: SerpApiJobResult } => r.success)
      .map((r) => r.data);

    cache.set(cacheKey, { fetchedAt: Date.now(), results: validResults });
    return { status: "ok", results: validResults };
  } catch (error) {
    const isTimeout = (error as { name?: string })?.name === "AbortError";
    return {
      status: isTimeout ? "rate_limited" : "error",
      results: [],
      message: isTimeout ? "SerpApi took too long to respond." : "Couldn't reach SerpApi right now.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * How many of expandSearchQueries()'s variants get dispatched in the
 * first, always-run tier — the broadest/highest-value ones
 * (query-expansion.ts orders them role-first). If that tier alone
 * already clears TIER_1_SUFFICIENT_RESULTS, the remaining (narrower,
 * individual-skill) variants are skipped entirely — cost control per
 * Part 7: "search 2-4 high-value variations, stop if enough high-quality
 * results are obtained, continue only if insufficient." Both tiers are
 * still dispatched in PARALLEL internally (Part "avoid unnecessary
 * sequential requests") — only the decision to run tier 2 at all is
 * sequential, gated on tier 1's actual result count.
 */
const TIER_1_QUERY_COUNT = 3;
const TIER_1_SUFFICIENT_RESULTS = 8;

export const serpApiJobProvider: JobSearchProvider = {
  name: "serpapi",
  label: "SerpApi Google Jobs",
  isDemo: false,

  async search(query: JobSearchQuery): Promise<ProviderSearchResult> {
    const apiKey = getSerpApiKey();
    if (!apiKey) {
      return {
        provider: "serpapi",
        status: "configuration_required",
        jobs: [],
        message: "SerpApi not configured (SERPAPI_API_KEY unset).",
      };
    }

    const queries = expandSearchQueries(query);
    if (queries.length === 0) {
      return { provider: "serpapi", status: "ok", jobs: [] };
    }

    const location = resolveSearchLocation(query);
    const tier1 = queries.slice(0, TIER_1_QUERY_COUNT);
    const tier2 = queries.slice(TIER_1_QUERY_COUNT);

    const tier1Outcomes = await Promise.all(tier1.map((q) => fetchOneQuery(q, location, query.country, apiKey)));
    const tier1RawCount = tier1Outcomes.reduce((sum, o) => sum + o.results.length, 0);

    const outcomes =
      tier2.length > 0 && tier1RawCount < TIER_1_SUFFICIENT_RESULTS
        ? [...tier1Outcomes, ...(await Promise.all(tier2.map((q) => fetchOneQuery(q, location, query.country, apiKey))))]
        : tier1Outcomes;

    const rawResults = outcomes.flatMap((o) => o.results);
    const normalized = rawResults.map(normalizeSerpApiJob);
    const droppedCount = normalized.filter((j) => j === null).length;
    if (droppedCount > 0) {
      // Count only — never the listing text itself (PART E: no job
      // descriptions in logs). Lets a false "no vacancies" report be
      // diagnosed as "provider returned N, M failed to normalize" instead
      // of a silent zero.
      console.error(`[jobs] serpapi: ${droppedCount}/${rawResults.length} raw results failed to normalize`);
    }

    const jobs = normalized
      .filter((j): j is NormalizedJob => j !== null)
      .map((j) => ({ ...j, country: query.country }))
      .slice(0, query.limit);

    const anyOk = outcomes.some((o) => o.status === "ok");
    if (anyOk) {
      return { provider: "serpapi", status: "ok", jobs, queriesExecuted: outcomes.length };
    }

    // Every query variant failed the same way — surface the first failure honestly.
    const failure = outcomes[0];
    return {
      provider: "serpapi",
      status: failure.status,
      jobs: [],
      message: failure.message,
      queriesExecuted: outcomes.length,
    };
  },
};
