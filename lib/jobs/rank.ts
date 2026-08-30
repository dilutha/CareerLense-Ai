import { classifyFreshness, freshnessAdjustment } from "./freshness";
import type { JobWithMatch } from "./types";
import { CHAT_QUALITY_FLOOR, CHAT_RESULT_COUNT, CHAT_RESULT_FALLBACK_COUNT, MAX_RANKED_RESULTS } from "./config";

/**
 * Deterministic final rank = match score + a small, bounded freshness
 * nudge (±4 points max, see freshness.ts) — freshness can only break a
 * near-tie, never let a fresher-but-weaker match outrank a much stronger
 * older one (e.g. a 95% older match must still beat a 65% fresh one).
 * Exact match-score ties fall back to raw recency as a final tiebreaker.
 */
function finalRank(item: JobWithMatch): number {
  const score = item.match?.match_score ?? 0;
  const freshness = classifyFreshness(item.job.posted_at, item.job.first_seen_at);
  return score + freshnessAdjustment(freshness);
}

/**
 * Ranks matched jobs primarily by (match score + bounded freshness), and
 * caps the list — never dumps dozens of results into the UI/Gemini
 * context at once (PROJECT_SPEC.md §41, §116).
 */
export function rankJobs(jobs: JobWithMatch[]): JobWithMatch[] {
  return [...jobs]
    .sort((a, b) => {
      const rankDiff = finalRank(b) - finalRank(a);
      if (rankDiff !== 0) return rankDiff;

      const aDate = a.job.posted_at ? new Date(a.job.posted_at).getTime() : 0;
      const bDate = b.job.posted_at ? new Date(b.job.posted_at).getTime() : 0;
      return bDate - aDate;
    })
    .slice(0, MAX_RANKED_RESULTS);
}

export interface ChatResultSelection {
  results: JobWithMatch[];
  /** True when fewer than CHAT_RESULT_FALLBACK_COUNT results actually
   *  cleared CHAT_QUALITY_FLOOR, so the caller can be honest about it
   *  rather than silently padding with weak matches. */
  belowQualityBar: boolean;
  /** How many of `results`, counting from the front, actually cleared
   *  CHAT_QUALITY_FLOOR — `results` is already sorted by rank (rankJobs),
   *  so those are always the leading entries. Lets a caller split a mixed
   *  batch into "Strong Matches" (the first `strongCount`) vs "Related
   *  Opportunities" (the rest) instead of one blanket "these are weak"
   *  disclaimer covering jobs that individually may not be weak at all. */
  strongCount: number;
}

/**
 * Picks the chat's top results from an already-ranked list — never more
 * than CHAT_RESULT_COUNT, and never padded with weak matches just to hit
 * that count (PROJECT_SPEC "if only 3 genuinely strong jobs exist, show
 * 3 — do not manufacture 5"). Falls back to the best few available (even
 * below the quality floor) only when almost nothing clears it, so the
 * user still gets *something* to react to, honestly labeled as weaker.
 */
export function selectChatResults(ranked: JobWithMatch[]): ChatResultSelection {
  const strong = ranked.filter((item) => (item.match?.match_score ?? 0) >= CHAT_QUALITY_FLOOR);

  if (strong.length >= CHAT_RESULT_FALLBACK_COUNT) {
    const results = strong.slice(0, CHAT_RESULT_COUNT);
    return { results, belowQualityBar: false, strongCount: results.length };
  }

  const results = ranked.slice(0, Math.max(strong.length, Math.min(CHAT_RESULT_FALLBACK_COUNT, ranked.length)));
  return { results, belowQualityBar: ranked.length > 0, strongCount: Math.min(strong.length, results.length) };
}
