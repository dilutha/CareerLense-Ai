import type { JobSourceType } from "./types";

export type SourceConfidence = "HIGH" | "MEDIUM" | "LOW";

/**
 * A fixed, documented mapping from source_type to a qualitative
 * confidence label — never a fabricated numeric score. "aggregator_result"
 * (SerpApi/Google Jobs) is MEDIUM, not HIGH: Google Jobs aggregates from
 * mixed-quality sources, and SerpApi's own docs don't guarantee
 * apply_options always resolves to the true original poster (see
 * lib/jobs/providers/serpapi.ts's header comment) — so it's rated a notch
 * below a direct API (ITPro) or a page CareerLens fetched and parsed
 * itself (company-careers).
 */
export function getSourceConfidence(sourceType: JobSourceType): SourceConfidence {
  switch (sourceType) {
    case "job_board":
    case "official_company":
      return "HIGH";
    case "aggregator_result":
      return "MEDIUM";
    case "fixture":
      return "LOW";
  }
}
