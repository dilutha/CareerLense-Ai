import type { NormalizedJob } from "../schemas";

export interface JobSearchQuery {
  role: string | null;
  location: string | null;
  country: string;
  level: string | null;
  workMode: string | null;
  keywords: string[];
  limit: number;
}

export interface ProviderSearchResult {
  provider: string;
  status: "ok" | "unavailable" | "error" | "rate_limited" | "blocked" | "configuration_required";
  jobs: NormalizedJob[];
  /** Set when status isn't "ok" — never fabricated results. */
  message?: string;
  /** How many distinct provider-level queries this search actually dispatched (tiered providers like SerpApi may stop early) — cost-control observability, not shown to end users. Omitted by providers that don't have a meaningful notion of "one query" (e.g. ITPro fetches one static list and filters locally). */
  queriesExecuted?: number;
}

export interface JobSearchProvider {
  /** Machine-readable name, e.g. "demo", "itpro". Doubles as the source registry key. */
  readonly name: string;
  /** Human-readable name for source badges/attribution, e.g. "ITPro.lk". */
  readonly label: string;
  /** Whether this provider is real, live third-party data vs. fixtures. */
  readonly isDemo: boolean;
  search(query: JobSearchQuery): Promise<ProviderSearchResult>;
  /** Fetch one job by this provider's own source_job_id, when supported (e.g. re-checking freshness). */
  getJob?(sourceJobId: string): Promise<NormalizedJob | null>;
  /** Cheap connectivity check, independent of running a real search. */
  healthCheck?(): Promise<{ ok: boolean; message?: string }>;
}

export type SourceAccessMethod =
  | "api"
  | "structured_data"
  | "user_supplied"
  | "manual_external"
  | "fixture";

export type SourceStatus =
  | "available"
  | "unavailable"
  | "rate_limited"
  | "blocked"
  | "configuration_required"
  | "error";

/**
 * One row in the source registry (lib/jobs/providers/registry.ts) —
 * describes every source CareerLens knows about, whether or not it's an
 * active, queryable JobSearchProvider. LinkedIn/XpressJobs/ikman appear
 * here as manual_external entries purely for UI/documentation purposes;
 * they are never wired into getActiveProviders().
 */
export interface SourceRegistryEntry {
  key: string;
  name: string;
  region: string;
  accessMethod: SourceAccessMethod;
  status: SourceStatus;
  /** True once an actual JobSearchProvider queries this source automatically. */
  automatedSearch: boolean;
  /** One-line, user-safe explanation of the current status. */
  statusReason: string;
}
