import "server-only";
import type { Job } from "./types";

/**
 * Identifies when a newly-stored job (from one source) is very likely the
 * same real-world vacancy as an EXISTING job from a DIFFERENT source —
 * e.g. "Data Science Intern - ABC Pvt Ltd" on ITPro vs. "Data Science
 * Internship | ABC (Pvt) Ltd" on the company's own careers page. Distinct
 * from lib/jobs/deduplicate.ts, which only catches exact repeats within
 * one search batch/source (same source_job_id or content_hash) — this
 * runs across sources, where content_hash always differs by construction
 * (it includes `source`).
 *
 * Deliberately conservative — two different companies both hiring for
 * "Data Analyst Intern" must never merge. Requires either an exact
 * application URL match, or agreement on ALL of normalized company +
 * normalized title + normalized location.
 */

function normalizeCompany(name: string | null): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\(pvt\)\s*ltd\.?|\bpvt\.?\s*ltd\.?|\bprivate\s*limited\b|\bltd\.?\b|\binc\.?\b|\bllc\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\binternship\b/g, "intern")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeLocation(location: string | null): string {
  if (!location) return "";
  return location
    .toLowerCase()
    .replace(/\s*\d+$/, "") // "Colombo 03" -> "colombo"
    .trim();
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export interface DuplicateCandidate {
  source: string;
  title: string;
  company: string | null;
  location: string | null;
  applicationUrl: string;
}

/**
 * Returns the existing job that `candidate` is confidently a duplicate of,
 * or null if no confident match is found. `existing` should already be
 * filtered to jobs from a DIFFERENT source than `candidate` (same-source
 * duplicates are deduplicate.ts's job) and reasonably scoped (e.g. by
 * approximate company name) rather than the entire jobs table.
 */
export function findCanonicalDuplicate(
  candidate: DuplicateCandidate,
  existing: Job[]
): Job | null {
  const candidateUrl = normalizeUrl(candidate.applicationUrl);
  const candidateCompany = normalizeCompany(candidate.company);
  const candidateTitle = normalizeTitle(candidate.title);
  const candidateLocation = normalizeLocation(candidate.location);

  for (const job of existing) {
    if (job.source === candidate.source) continue;

    if (normalizeUrl(job.application_url) === candidateUrl) {
      return job;
    }

    if (!candidateCompany || !candidateTitle) continue;

    const sameCompany = normalizeCompany(job.company_name) === candidateCompany;
    const sameTitle = normalizeTitle(job.title) === candidateTitle;
    const sameLocation = normalizeLocation(job.location) === candidateLocation;

    if (sameCompany && sameTitle && sameLocation) {
      return job;
    }
  }

  return null;
}
