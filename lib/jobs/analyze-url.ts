import "server-only";
import { storeImportedJob } from "./discovery";
import { importJobFromUrl } from "./providers/company-careers";
import type { Job } from "./types";

/** A URL anywhere in the message — chat doesn't require the whole message to be just the link. */
const URL_PATTERN = /https?:\/\/[^\s)"'<>]+/i;

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  return match ? match[0] : null;
}

export type AnalyzeJobUrlResult = { success: true; job: Job } | { success: false; reason: string };

/**
 * The user-submitted-URL half of Part 2/17's pipeline: fetch the page
 * (SSRF-guarded, robots.txt-respecting — see providers/company-careers.ts
 * and url-safety.ts, both pre-existing), extract schema.org JobPosting
 * data if present, store it in the shared `jobs` table like any other
 * discovered listing. Matching against the caller's profile happens
 * separately (matchAndCacheJobs for an authenticated user, matchJobForGuest
 * for a guest) — this function only resolves the job itself.
 *
 * Real, honest limitation: this only works for pages that embed
 * structured JobPosting data in their server-rendered HTML. Several major
 * Sri Lankan job boards (confirmed live: xpress.jobs) are client-side
 * rendered React/Vue SPAs — the initial HTML is just an empty <div
 * id="root"> with no job content at all, so no server-side fetch can ever
 * extract data from them without executing page JavaScript, which this
 * project deliberately never does (Part 27 — SSRF/script-execution
 * safety). That's a genuine site-architecture limitation, not a bug here.
 */
export async function analyzeJobUrl(rawUrl: string): Promise<AnalyzeJobUrlResult> {
  const imported = await importJobFromUrl(rawUrl);
  if (!imported.success) {
    return { success: false, reason: imported.reason };
  }

  const job = await storeImportedJob(imported.job);
  if (!job) {
    return { success: false, reason: "Found the job, but couldn't save it. Try again." };
  }

  return { success: true, job };
}
