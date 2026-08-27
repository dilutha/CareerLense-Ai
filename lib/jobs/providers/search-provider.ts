import "server-only";
import type { JobSearchProvider, ProviderSearchResult } from "./types";

/**
 * A real, live job-discovery provider backed by a permitted web-search API
 * (e.g. Tavily, Serper, Bing Web Search) — NOT implemented in Phase 7,
 * since no such credential is currently configured (no
 * JOB_SEARCH_API_KEY). This exists to satisfy the provider interface and
 * make the intended integration point explicit, not to fake one.
 *
 * When a provider is available, this should construct search queries
 * conceptually like `site:linkedin.com/jobs/view "Data Analyst" "Colombo"`
 * against the search API (never by scraping Google/LinkedIn HTML
 * directly), normalize each result into NormalizedJob, and return them —
 * see docs/JOB_DATA.md for the source-by-source legitimacy assessment.
 */
export function createSearchProvider(): JobSearchProvider {
  const apiKey = process.env.JOB_SEARCH_API_KEY;

  return {
    name: "search",
    label: "Web Search",
    isDemo: false,
    async search(): Promise<ProviderSearchResult> {
      if (!apiKey) {
        return {
          provider: "search",
          status: "unavailable",
          jobs: [],
          message: "No job search provider is configured yet.",
        };
      }
      // Real implementation intentionally not built yet — see docstring.
      return {
        provider: "search",
        status: "unavailable",
        jobs: [],
        message: "Search provider integration is not implemented yet.",
      };
    },
  };
}
