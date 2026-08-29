/**
 * Parses a relative date string (e.g. "3 days ago", "Just posted") into an
 * absolute ISO timestamp — deterministic, mechanical parsing, never a
 * guess. Used for providers that don't give an absolute posted date
 * (SerpApi's Google Jobs `detected_extensions.posted_at` is typically
 * relative text, not an ISO timestamp). Returns null for anything not
 * confidently parseable, per PROJECT_SPEC's "never invent posted dates —
 * if unreliable, mark Unknown" rule; the caller stores null, which
 * lib/jobs/freshness.ts already renders as "Unknown".
 */
export function parseRelativeDate(text: string, now: Date = new Date()): string | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  if (/^(just posted|today|just now)$/.test(normalized)) {
    return now.toISOString();
  }
  if (normalized === "yesterday") {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  const match = normalized.match(/^(\d+)\+?\s*(hour|day|week|month)s?\s+ago$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  const msPerUnit: Record<string, number> = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000, // approximate — "months ago" is never exact anyway
  };

  return new Date(now.getTime() - amount * msPerUnit[unit]).toISOString();
}
