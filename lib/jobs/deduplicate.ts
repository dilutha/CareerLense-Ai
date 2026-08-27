import "server-only";
import type { NormalizedJob } from "./schemas";
import { computeContentHash } from "./normalize";

/**
 * Removes duplicates within one search batch (e.g. the same vacancy
 * appearing via two providers) before it reaches the database, which has
 * its own unique constraints as a second line of defense. Keys on
 * source+sourceJobId when a provider gives us one, falling back to the
 * content hash — never on title alone, so two different companies hiring
 * for the same title aren't accidentally merged.
 */
export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  const result: NormalizedJob[] = [];

  for (const job of jobs) {
    const key = job.sourceJobId ? `${job.source}:${job.sourceJobId}` : computeContentHash(job);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(job);
  }

  return result;
}
