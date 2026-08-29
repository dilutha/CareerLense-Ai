export type FreshnessLabel = "Fresh" | "Recent" | "Older" | "Unknown";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Classifies a listing's age from the best available timestamp — prefers
 *  postedAt (what the source claims) over firstSeenAt (when we noticed
 *  it), since a source may republish an older listing we hadn't seen yet. */
export function classifyFreshness(postedAt: string | null, firstSeenAt: string | null): FreshnessLabel {
  const reference = postedAt ?? firstSeenAt;
  if (!reference) return "Unknown";

  const date = new Date(reference);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const ageDays = (Date.now() - date.getTime()) / DAY_MS;
  if (ageDays < 0) return "Unknown"; // clock skew / bad data — don't claim freshness we can't back up
  if (ageDays <= 3) return "Fresh";
  if (ageDays <= 14) return "Recent";
  return "Older";
}

/**
 * Small, bounded ranking nudge from freshness — deliberately capped low
 * (max ±4 points) so it can only break near-ties, never let a fresh weak
 * match outrank a much stronger older one (PROJECT_SPEC's own worked
 * example: a 95% older match must beat a 65% fresh one).
 */
export function freshnessAdjustment(label: FreshnessLabel): number {
  switch (label) {
    case "Fresh":
      return 4;
    case "Recent":
      return 1;
    case "Older":
      return 0;
    case "Unknown":
      return -1;
  }
}
