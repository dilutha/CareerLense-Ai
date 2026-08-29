import type { Job } from "@/lib/jobs/types";
import { CURRENTLY_AT_OR_PAST_INTERVIEW } from "./schemas";
import type { ApplicationRow } from "./types";

export interface SourcePerformanceEntry {
  sourceType: string;
  sourceLabel: string;
  applications: number;
  interviews: number;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  job_board: "Job Boards (e.g. ITPro.lk)",
  aggregator_result: "LinkedIn / Aggregator (via Google Jobs)",
  official_company: "Official Company Careers",
  fixture: "Demo Data",
};

/**
 * Deterministic application-count and interview-count per source_type
 * (Phase 10A's provenance field) — a minimum-sample-size note is the
 * caller's job to render (this function just returns real counts, never
 * invents a percentage from a tiny sample).
 */
export function computeSourcePerformance(
  applications: ApplicationRow[],
  jobsById: Map<string, Job>
): SourcePerformanceEntry[] {
  const bySource = new Map<string, { applications: number; interviews: number }>();

  for (const application of applications) {
    const job = jobsById.get(application.job_id);
    if (!job) continue;
    const key = job.source_type;
    const entry = bySource.get(key) ?? { applications: 0, interviews: 0 };
    entry.applications += 1;
    if (CURRENTLY_AT_OR_PAST_INTERVIEW.includes(application.status)) entry.interviews += 1;
    bySource.set(key, entry);
  }

  return [...bySource.entries()]
    .map(([sourceType, counts]) => ({
      sourceType,
      sourceLabel: SOURCE_TYPE_LABELS[sourceType] ?? sourceType,
      ...counts,
    }))
    .sort((a, b) => b.applications - a.applications);
}
