import "server-only";
import type { NormalizedJob } from "./schemas";
import { computeContentHash } from "./normalize";

/**
 * Removes duplicates within one search batch (e.g. the same vacancy
 * appearing via two providers, or via two different query variants of
 * the same provider) before it reaches the database.
 *
 * content_hash is ALWAYS checked — it's the database's own unique
 * constraint (jobs.content_hash, see discovery.ts's
 * `.upsert(rows, { onConflict: "content_hash" })`), so two jobs sharing
 * one can never both survive into the same upsert batch. This was a real
 * bug, found live: this function previously keyed ONLY on
 * source:sourceJobId whenever a provider supplied one, skipping the
 * content-hash check entirely in that case. SerpAPI's own tiered
 * multi-query dispatch can return the exact same real posting under two
 * DIFFERENT sourceJobId values across different query variants (Google's
 * Jobs API assigns per-query result ids, not a stable global one) — both
 * survived dedup with different sourceJobId keys, then Postgres rejected
 * the WHOLE batch with "ON CONFLICT DO UPDATE command cannot affect row
 * a second time", silently discarding every job in that search (not just
 * the duplicates).
 *
 * source:sourceJobId is still also checked, for the case a provider's
 * stable id is the more precise signal (e.g. two fetches of the exact
 * same ITPro job id where some other field drifted slightly, so the
 * content_hash wouldn't otherwise catch it).
 */
export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  const result: NormalizedJob[] = [];

  for (const job of jobs) {
    const contentKey = computeContentHash(job);
    const sourceKey = job.sourceJobId ? `${job.source}:${job.sourceJobId}` : null;
    if (seen.has(contentKey) || (sourceKey && seen.has(sourceKey))) continue;
    seen.add(contentKey);
    if (sourceKey) seen.add(sourceKey);
    result.push(job);
  }

  return result;
}
