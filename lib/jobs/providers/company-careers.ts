import "server-only";
import { extractJobPostingFromHtml } from "../jobposting-schema";
import { NormalizedJobSchema, type NormalizedJob } from "../schemas";
import { assertSafeExternalUrl, isAllowedByRobotsTxt, safeFetchText } from "../url-safety";
import type { JobSearchProvider, JobSearchQuery, ProviderSearchResult } from "./types";

/**
 * A company's careers/jobs listing page — the URL is fetched, checked
 * against robots.txt, and scanned for schema.org JobPosting JSON-LD (the
 * same structured data companies publish for Google for Jobs). Only add
 * an entry here after manually confirming the page actually embeds
 * JobPosting data — do not add a company on the assumption that it does.
 *
 * No entries are seeded as of Phase 9: WSO2 and Virtusa's public career
 * pages were checked directly this session and both returned HTTP 403 to
 * a normal automated request (bot-protected), and no other candidate was
 * verified in time — see docs/JOB_DATA.md for the exact findings. This
 * array is the extension point for whichever pages get verified later;
 * it deliberately isn't hardcoded to any specific company.
 */
export interface CompanyCareerSource {
  company: string;
  careerUrl: string;
}

export const COMPANY_CAREER_SOURCES: CompanyCareerSource[] = [];

function toNormalizedJob(fallbackCompany: string | null, sourceUrl: string, posting: ReturnType<typeof extractJobPostingFromHtml>): NormalizedJob | null {
  if (!posting) return null;

  const candidate = {
    source: "company-careers",
    sourceName: posting.company ?? fallbackCompany,
    sourceType: "official_company",
    sourceJobId: null,
    title: posting.title,
    company: posting.company ?? fallbackCompany,
    location: posting.location,
    country: "Sri Lanka",
    employmentType: normalizeEmploymentType(posting.employmentType),
    workMode: null,
    description: posting.description,
    responsibilities: [],
    requirements: [],
    salaryText: posting.salaryText,
    postedAt: posting.datePosted ? safeIsoDate(posting.datePosted) : null,
    applicationUrl: posting.applicationUrl && isHttpsUrl(posting.applicationUrl) ? posting.applicationUrl : sourceUrl,
    sourceUrl,
  };

  const result = NormalizedJobSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function safeIsoDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const SCHEMA_EMPLOYMENT_TYPE_MAP: Record<string, NormalizedJob["employmentType"]> = {
  full_time: "full_time",
  fulltime: "full_time",
  part_time: "part_time",
  parttime: "part_time",
  contractor: "contract",
  contract: "contract",
  intern: "internship",
  internship: "internship",
  temporary: "contract",
  volunteer: "volunteer",
};

function normalizeEmploymentType(raw: string | null): NormalizedJob["employmentType"] {
  if (!raw) return null;
  return SCHEMA_EMPLOYMENT_TYPE_MAP[raw.toLowerCase().replace(/[\s-]/g, "_")] ?? null;
}

async function fetchOneCompany(source: CompanyCareerSource): Promise<NormalizedJob | null> {
  const url = assertSafeExternalUrl(source.careerUrl);
  const allowed = await isAllowedByRobotsTxt(url);
  if (!allowed) {
    console.error(`[jobs] company-careers: robots.txt disallows ${source.careerUrl}, skipping`);
    return null;
  }

  const html = await safeFetchText(source.careerUrl);
  const posting = extractJobPostingFromHtml(html);
  return toNormalizedJob(source.company, source.careerUrl, posting);
}

function matchesQuery(job: NormalizedJob, query: JobSearchQuery): boolean {
  if (!query.role) return true;
  const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
  const tokens = query.role.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  return tokens.length === 0 || tokens.some((t) => haystack.includes(t));
}

export const companyCareersProvider: JobSearchProvider = {
  name: "company-careers",
  label: "Company Careers",
  isDemo: false,

  async search(query: JobSearchQuery): Promise<ProviderSearchResult> {
    if (COMPANY_CAREER_SOURCES.length === 0) {
      return {
        provider: "company-careers",
        status: "configuration_required",
        jobs: [],
        message: "No verified company career pages are configured yet.",
      };
    }

    const settled = await Promise.allSettled(COMPANY_CAREER_SOURCES.map(fetchOneCompany));
    const jobs = settled
      .filter((r): r is PromiseFulfilledResult<NormalizedJob | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((j): j is NormalizedJob => j !== null)
      .filter((job) => matchesQuery(job, query))
      .slice(0, query.limit);

    return { provider: "company-careers", status: "ok", jobs };
  },
};

/**
 * On-demand import for a single career-page or job-posting URL the user
 * (or a chat "paste this job URL" flow) supplies directly — used by both
 * the /jobs "add a job by URL" path and, potentially, the LinkedIn/
 * XpressJobs/ikman manual-import fallback when the pasted URL happens to
 * be a company page with JobPosting data rather than a source this project
 * can't automate. Never claims a specific source (e.g. "found on
 * LinkedIn") beyond what was actually fetched.
 */
export async function importJobFromUrl(rawUrl: string): Promise<
  { success: true; job: NormalizedJob } | { success: false; reason: string }
> {
  let url: URL;
  try {
    url = assertSafeExternalUrl(rawUrl);
  } catch {
    return { success: false, reason: "That doesn't look like a valid https:// URL." };
  }

  const allowed = await isAllowedByRobotsTxt(url);
  if (!allowed) {
    return {
      success: false,
      reason: "This site's robots.txt doesn't allow automated access to that page.",
    };
  }

  let html: string;
  try {
    html = await safeFetchText(rawUrl);
  } catch {
    return { success: false, reason: "Couldn't fetch that page." };
  }

  const posting = extractJobPostingFromHtml(html);
  if (!posting) {
    return {
      success: false,
      reason: "Couldn't find structured job data on that page — paste the job description text instead.",
    };
  }

  const job = toNormalizedJob(posting.company, rawUrl, posting);
  if (!job) {
    return { success: false, reason: "Found job data on that page, but it was missing required fields." };
  }

  return { success: true, job };
}
