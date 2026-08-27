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
  status: "ok" | "unavailable" | "error";
  jobs: NormalizedJob[];
  /** Set when status is "unavailable" or "error" — never fabricated results. */
  message?: string;
}

export interface JobSearchProvider {
  /** Machine-readable name, e.g. "demo", "linkedin-search". */
  readonly name: string;
  /** Human-readable name for source badges/attribution, e.g. "Demo Data". */
  readonly label: string;
  /** Whether this provider is real, live third-party data vs. fixtures. */
  readonly isDemo: boolean;
  search(query: JobSearchQuery): Promise<ProviderSearchResult>;
}
