import "server-only";
import { htmlToPlainText } from "../html-strip";
import { NormalizedJobSchema, type NormalizedJob } from "../schemas";
import type { JobSearchProvider, JobSearchQuery, ProviderSearchResult } from "./types";

/**
 * ITPro.lk (https://itpro.lk) — a real, live Sri Lankan job board with a
 * public JSON API, confirmed by direct investigation this session (see
 * docs/JOB_DATA.md for the full verification notes):
 *
 *   GET https://itpro.lk/api/v1/jobs        — latest listings, no API key
 *                                              required for reads (confirmed
 *                                              working with zero auth headers)
 *   GET https://itpro.lk/api/v1/jobs/{id}   — single job detail
 *
 * The developer docs (https://itpro.lk/developer/) describe an X-API-Key
 * header for write/application-management endpoints, issued when a job is
 * posted or on request to info@itpro.lk — not needed for the read-only
 * search this provider performs, so ITPRO_API_KEY is intentionally NOT a
 * required env var. If ITPro later requires a key for reads too, this
 * provider should pick it up from process.env.ITPRO_API_KEY (see below) —
 * it's already wired to send it when present.
 *
 * Known API limitations (undocumented, so not worked around — never
 * guessed): no documented pagination/filtering (the endpoint appears to
 * just return the current "latest jobs" set — currently ~10), no
 * documented rate limit, `location` and `type_id` are numeric codes with
 * NO public lookup table (no /locations, /categories, or /types endpoint
 * exists — all return 404, verified directly). Inventing a code→name
 * mapping would violate the project's "never invent missing information"
 * rule, so this provider deliberately leaves NormalizedJob.location null
 * for ITPro jobs rather than guessing a city from a number. Employment
 * type and work mode ARE recovered, but only via literal keyword
 * detection against ITPro's own `summary` sentence (e.g. it containing
 * the literal word "Internship") — reading the source's own words, not
 * inferring anything it didn't say.
 */

const ITPRO_API_BASE = "https://itpro.lk/api/v1";
const ITPRO_JOBS_URL = `${ITPRO_API_BASE}/jobs`;
const REQUEST_TIMEOUT_MS = 8000;

// Very short in-process cache — avoids hitting ITPro again for back-to-back
// searches from different users on the same server instance within a few
// minutes (see docs/JOB_DATA.md "Caching"). Not a substitute for real
// per-listing dedup, which still happens via content_hash downstream.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { fetchedAt: number; jobs: ItProJob[] } | null = null;

export interface ItProJob {
  id: string | number;
  title: string;
  description: string | null;
  summary: string | null;
  type_id: string | number | null;
  category_id: string | number | null;
  location: string | number | null;
  company: string | null;
  website: string | null;
  views_count?: string | number;
  created_on: string | null;
}

const EMPLOYMENT_TYPE_KEYWORDS: [RegExp, NormalizedJob["employmentType"]][] = [
  [/\binternship\b/i, "internship"],
  [/\bpart[\s-]?time\b/i, "part_time"],
  [/\bfull[\s-]?time\b/i, "full_time"],
  [/\bcontract\b/i, "contract"],
  [/\bfreelance\b/i, "freelance"],
  [/\bvolunteer\b/i, "volunteer"],
];

export function inferEmploymentType(text: string): NormalizedJob["employmentType"] {
  for (const [pattern, type] of EMPLOYMENT_TYPE_KEYWORDS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

const WORK_MODE_KEYWORDS: [RegExp, NormalizedJob["workMode"]][] = [
  [/\bremote\b/i, "remote"],
  [/\bhybrid\b/i, "hybrid"],
  [/\bon[\s-]?site\b/i, "onsite"],
];

export function inferWorkMode(text: string): NormalizedJob["workMode"] {
  for (const [pattern, mode] of WORK_MODE_KEYWORDS) {
    if (pattern.test(text)) return mode;
  }
  return null;
}

/** Best-effort slug for a nicer URL — ITPro's own server redirects on ID
 *  alone regardless of slug correctness (verified live), so this never
 *  needs to match their exact algorithm to resolve correctly. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toNormalizedJob(raw: ItProJob): NormalizedJob | null {
  if (!raw.id || !raw.title) return null;

  const summary = raw.summary ?? "";
  const description = raw.description ? htmlToPlainText(raw.description) : null;
  const combinedText = `${summary} ${description ?? ""}`;

  const jobUrl = `https://itpro.lk/job/${raw.id}/${slugify(raw.title)}/`;

  const candidate = {
    source: "itpro",
    sourceName: "ITPro.lk",
    sourceType: "job_board",
    sourceJobId: String(raw.id),
    title: raw.title,
    company: raw.company || null,
    location: null, // numeric code, no public mapping — never guessed (see file header)
    country: "Sri Lanka",
    employmentType: inferEmploymentType(combinedText),
    workMode: inferWorkMode(combinedText),
    description: description ?? summary ?? null,
    responsibilities: [],
    requirements: [],
    salaryText: null,
    postedAt: raw.created_on ? new Date(raw.created_on.replace(" ", "T")).toISOString() : null,
    applicationUrl: jobUrl,
    sourceUrl: jobUrl,
  };

  const result = NormalizedJobSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

async function fetchJobs(): Promise<ItProJob[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.jobs;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const apiKey = process.env.ITPRO_API_KEY;
    const response = await fetch(ITPRO_JOBS_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`ITPro API responded with status ${response.status}`);
    }

    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new Error("ITPro API returned an unexpected shape (expected an array).");
    }

    const jobs = data as ItProJob[];
    cache = { fetchedAt: Date.now(), jobs };
    return jobs;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * A coarse relevance gate only — NOT the real matcher. Its one job is to
 * keep totally unrelated postings (e.g. a "Sales Executive" listing) out
 * of an "SQL Data Analyst" search on a feed with no server-side filtering.
 * It deliberately does NOT require keyword overlap: keywords are exact
 * substrings (e.g. "power bi") and a real listing routinely phrases the
 * same skill differently ("PowerBI", "Power BI dashboards") or simply
 * doesn't restate every skill in the title/description. Requiring an
 * AND-match on keywords here silently dropped genuinely relevant jobs
 * before they ever reached computeJobMatch, which already scores partial
 * keyword/skill overlap gracefully — this gate must not duplicate or
 * pre-empt that scoring. Role tokens still gate (OR within tokens) since
 * that's the one signal cheap and reliable enough to reject on here.
 */
export function matchesQuery(job: NormalizedJob, query: JobSearchQuery): boolean {
  if (!query.role) return true;

  const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
  const tokens = query.role.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  return tokens.length === 0 || tokens.some((t) => haystack.includes(t));
}

export const itproJobProvider: JobSearchProvider = {
  name: "itpro",
  label: "ITPro.lk",
  isDemo: false,

  async search(query: JobSearchQuery): Promise<ProviderSearchResult> {
    try {
      const raw = await fetchJobs();
      const normalized = raw.map(toNormalizedJob).filter((j): j is NormalizedJob => j !== null);
      const filtered = normalized.filter((job) => matchesQuery(job, query)).slice(0, query.limit);

      return { provider: "itpro", status: "ok", jobs: filtered };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[jobs] ITPro provider failed:", message);
      const isTimeout = (error as { name?: string })?.name === "AbortError";
      return {
        provider: "itpro",
        status: isTimeout ? "rate_limited" : "error",
        jobs: [],
        message: isTimeout
          ? "ITPro.lk took too long to respond."
          : "Couldn't reach ITPro.lk right now.",
      };
    }
  },

  async getJob(sourceJobId: string): Promise<NormalizedJob | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${ITPRO_API_BASE}/jobs/${encodeURIComponent(sourceJobId)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return null;
        const raw = (await response.json()) as ItProJob;
        return toNormalizedJob(raw);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return null;
    }
  },

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    try {
      const jobs = await fetchJobs();
      return { ok: Array.isArray(jobs) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  },
};
