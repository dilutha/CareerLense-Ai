import { expandDomainVariants } from "../query-expansion";
import type { NormalizedJob } from "../schemas";
import type { JobSearchQuery } from "./types";

// Common short tech/domain acronyms that are meaningful signal on their
// own — the general length filter below exists to drop noise words ("a",
// "in", "of"), not these.
const SHORT_TOKEN_ALLOWLIST = new Set(["ai", "ml", "bi", "qa", "ux", "ui"]);

function roleTokens(role: string): string[] {
  return role
    .toLowerCase()
    .split(/[\s/,&]+/) // also split "AI/ML/Data Science" into separate tokens, not one unmatched blob
    .filter((t) => t.length > 2 || SHORT_TOKEN_ALLOWLIST.has(t));
}

/**
 * Word-boundary match, not raw substring — caught live this session:
 * `haystack.includes("ai")` matched "Business Analyst" and "Head of
 * Engineering" purely because their descriptions contained ordinary words
 * like "training"/"maintain"/"domain" (any word containing "ai" as a
 * substring), and `haystack.includes("intern")` similarly matched
 * "internal"/"international"/"internet". A live ITPro check during this
 * fix showed a 10/10 "match everything" result before this was caught —
 * word-boundary matching is what actually keeps the gate coarse-but-real
 * rather than accidentally permissive. Token is user/query-derived text,
 * so regex metacharacters are escaped before being interpolated.
 */
function textContainsToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

/**
 * Shared coarse relevance gate for providers that filter a locally-fetched
 * job list rather than dispatching separate provider queries per variant
 * (itpro.ts, company-careers.ts) — NOT the real matcher, just enough to
 * keep totally unrelated postings out. Deliberately does NOT require
 * keyword overlap (see itpro.ts's original header comment for why); role
 * tokens gate (OR within tokens), and domain-expanded variants
 * (query-expansion.ts) are checked too so a job titled "Machine Learning
 * Intern" still passes an "AI/ML/Data Science Intern" search even though
 * neither string is a literal substring of the other.
 */
export function matchesRoleQuery(job: NormalizedJob, query: JobSearchQuery): boolean {
  if (!query.role) return true;

  const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
  const tokens = roleTokens(query.role);
  if (tokens.length === 0 || tokens.some((t) => textContainsToken(haystack, t))) return true;

  const domainVariants = expandDomainVariants(query.role, query.level === "internship");
  return domainVariants.some((variant) => roleTokens(variant).some((t) => textContainsToken(haystack, t)));
}
