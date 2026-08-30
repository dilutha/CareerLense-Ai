import type { JobSearchQuery } from "./providers/types";

/** Hard cap on API calls a single user search can trigger against a paid,
 *  metered provider (PROJECT_SPEC's "SerpApi cost protection" / "no
 *  autonomous crawling" instructions) — never generate more variants than this. */
export const MAX_QUERY_VARIANTS = 6;

/** How many of the candidate's individual skills get their own standalone query variant. */
const MAX_SKILL_VARIANTS = 3;
/** How many keywords ride along in the "precise" role+skills variant — kept small so that variant doesn't over-constrain the search (see header comment). */
const PRECISE_VARIANT_KEYWORD_COUNT = 2;

function withInternshipSuffix(text: string, isInternship: boolean): string {
  if (!isInternship || /\bintern(ship)?\b/i.test(text)) return text;
  return `${text} intern`;
}

/**
 * Controlled, bounded query expansion — several DISTINCT, separately-
 * dispatched queries (each provider call runs them in parallel, see
 * providers/serpapi.ts), not one giant combined string.
 *
 * Real bug found and fixed here: the previous version joined the role AND
 * every keyword (every profile skill folded in by build-search-criteria.ts
 * — which can easily be 5-10 terms) into ONE query string. A search
 * engine treats a longer query as more restrictive, not broader — asking
 * for "Software Engineer Intern Python Flutter Spring Boot Machine
 * Learning AI SQL" in one query is far LESS likely to match a real
 * posting than several separate, focused queries. This generates: the
 * role alone (broadest), role+internship suffix, role + a SMALL number of
 * top keywords (a "precise" variant), and each of a few individual top
 * skills as their own query (catches postings that name a skill but never
 * repeat the base role text, e.g. "Python Intern" with no "Software
 * Engineer" anywhere in it). Still bounded and deduplicated — not a
 * semantic explosion.
 */
export function expandSearchQueries(query: JobSearchQuery): string[] {
  const role = query.role?.trim() || null;
  const keywords = query.keywords.map((k) => k.trim()).filter(Boolean);

  if (!role && keywords.length === 0) return [];

  const isInternship = query.level === "internship";
  const variants: string[] = [];

  if (role) {
    variants.push(role);
    variants.push(withInternshipSuffix(role, isInternship));
    if (keywords.length > 0) {
      variants.push([role, ...keywords.slice(0, PRECISE_VARIANT_KEYWORD_COUNT)].join(" "));
    }
  }

  for (const skill of keywords.slice(0, MAX_SKILL_VARIANTS)) {
    variants.push(withInternshipSuffix(skill, isInternship));
  }

  if (variants.length === 0 && keywords.length > 0) {
    // No role at all — fall back to the keywords alone, still one variant.
    variants.push(keywords.join(" "));
  }

  return [...new Set(variants.map((v) => v.trim()).filter(Boolean))].slice(0, MAX_QUERY_VARIANTS);
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
