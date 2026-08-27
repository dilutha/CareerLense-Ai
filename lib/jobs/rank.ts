import type { JobWithMatch } from "./types";
import { MAX_RANKED_RESULTS } from "./config";

/**
 * Ranks matched jobs primarily by match score, with recency as a
 * tiebreaker, and caps the list — never dumps dozens of results into the
 * UI/Gemini context at once (PROJECT_SPEC.md §41, §116).
 */
export function rankJobs(jobs: JobWithMatch[]): JobWithMatch[] {
  return [...jobs]
    .sort((a, b) => {
      const scoreDiff = (b.match?.match_score ?? 0) - (a.match?.match_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;

      const aDate = a.job.posted_at ? new Date(a.job.posted_at).getTime() : 0;
      const bDate = b.job.posted_at ? new Date(b.job.posted_at).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, MAX_RANKED_RESULTS);
}
