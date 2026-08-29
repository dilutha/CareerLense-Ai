import "server-only";
import { companyCareersProvider } from "./company-careers";
import { demoJobProvider } from "./demo";
import { itproJobProvider } from "./itpro";
import { serpApiJobProvider } from "./serpapi";
import type { JobSearchProvider } from "./types";

export type { JobSearchProvider, JobSearchQuery, ProviderSearchResult } from "./types";
export { SOURCE_REGISTRY, getSourceRegistryEntry } from "./registry";

/**
 * Active provider set, controlled by JOB_SEARCH_PROVIDER (defaults to
 * "real"):
 *
 *   "real" (default) — itpro (verified, working, real live data) +
 *     company-careers (mechanism ready, currently zero seeded pages —
 *     returns configuration_required honestly) + serpapi (real Google
 *     Jobs aggregation, if SERPAPI_API_KEY is set — otherwise reports
 *     configuration_required honestly, same as before). No demo/fixture
 *     jobs are mixed in — if these return nothing for a query, the
 *     caller should say so honestly rather than padding with fixtures.
 *
 *   "demo" — only the fixture provider, for local UI development without
 *     hitting real external services. Every job from it carries
 *     source: "demo" end to end, so the UI can label it regardless of
 *     which mode is active — see lib/jobs/summary.ts.
 *
 * One provider failing never fails the whole search — see
 * discovery.ts#runProvider and ProviderSearchResult's per-provider status.
 */
export function getActiveProviders(): JobSearchProvider[] {
  const mode = (process.env.JOB_SEARCH_PROVIDER ?? "real").trim().toLowerCase();

  if (mode === "demo") {
    return [demoJobProvider];
  }

  // serpApiJobProvider is always included (like companyCareersProvider) —
  // it reports its own "configuration_required" status honestly when
  // SERPAPI_API_KEY is unset, rather than silently disappearing from
  // providerStatus, which would look like the source was forgotten.
  return [itproJobProvider, companyCareersProvider, serpApiJobProvider];
}
