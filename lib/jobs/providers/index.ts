import "server-only";
import { demoJobProvider } from "./demo";
import { createSearchProvider } from "./search-provider";
import type { JobSearchProvider } from "./types";

export type { JobSearchProvider, JobSearchQuery, ProviderSearchResult } from "./types";

/**
 * Active provider set, controlled by JOB_SEARCH_PROVIDER. Defaults to the
 * demo provider — there is currently no real search API credential
 * configured (JOB_SEARCH_API_KEY unset), so production would otherwise
 * have nothing to search. The demo provider's results are always labeled
 * "Demo Data" in the UI (see JobSearchProvider.isDemo) — never presented
 * as real listings.
 *
 * Multiple providers can be active at once later (e.g. demo + search);
 * discovery.ts already handles partial per-provider failure.
 */
export function getActiveProviders(): JobSearchProvider[] {
  const mode = (process.env.JOB_SEARCH_PROVIDER ?? "demo").trim().toLowerCase();

  if (mode === "search") {
    return [createSearchProvider()];
  }

  return [demoJobProvider];
}
