import type { JobSearchQuery } from "./providers/types";

/** Hard cap on API calls a single user search can trigger against a paid,
 *  metered provider (PROJECT_SPEC's "SerpApi cost protection" / "no
 *  autonomous crawling" instructions) — never generate more variants than this. */
export const MAX_QUERY_VARIANTS = 2;

/**
 * Controlled, bounded query expansion — NOT a semantic explosion. Adds at
 * most one extra, clearly-justified variant (an internship-specific
 * phrasing) rather than generating synonym after synonym. Deduplicates
 * identical variants.
 */
export function expandSearchQueries(query: JobSearchQuery): string[] {
  const base = [query.role, ...query.keywords].filter((s): s is string => Boolean(s && s.trim())).join(" ").trim();

  if (!base) return [];

  const variants = [base];

  const isInternship = query.level === "internship";
  const alreadyMentionsIntern = /\bintern(ship)?\b/i.test(base);
  if (isInternship && !alreadyMentionsIntern) {
    variants.push(`${base} internship`);
  }

  return [...new Set(variants)].slice(0, MAX_QUERY_VARIANTS);
}

/**
 * Resolves the location string sent to a geo-aware provider from the
 * query's own location/country — never fans out into multiple city calls
 * per search (that would multiply metered-API cost); "Sri Lanka" alone is
 * a perfectly valid SerpApi location value when no city was given.
 */
export function resolveSearchLocation(query: JobSearchQuery): string | null {
  if (query.workMode === "remote" && !query.location) {
    // Let "remote" ride in the query text itself rather than forcing a
    // location filter that could exclude genuinely remote postings.
    return null;
  }
  if (query.location) {
    return query.country ? `${query.location}, ${query.country}` : query.location;
  }
  return query.country || null;
}
