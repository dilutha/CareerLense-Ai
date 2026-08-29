import type { JobSearchQuery } from "@/lib/jobs/providers/types";
import type { CareerAgentState, SeniorityLevel } from "./schema";

const SENIORITY_TO_LEVEL: Record<SeniorityLevel, JobSearchQuery["level"]> = {
  internship: "internship",
  entry_level: "entry_level",
  junior: "junior",
  mid: "mid_level",
  senior: "senior",
};

/**
 * Converts the richer conversational state into the EXISTING JobSearchQuery
 * shape (lib/jobs/providers/types.ts) — reused as-is, never a second
 * search implementation (Part 8). `JobSearchQuery` only supports one
 * location/workMode, so the primary (most recently stated) one is used;
 * everything the existing query shape can't express directly
 * (companyTypes/internationalPreference/industries/technologies) is
 * folded into `keywords` instead — the existing deterministic
 * keyword-score component (lib/jobs/match.ts) is what actually rewards a
 * match on those, honestly, rather than this function pretending to
 * filter on a "company type" field no job source provides (see
 * schema.ts's header comment).
 */
export function buildSearchCriteria(state: CareerAgentState, limit: number): Partial<JobSearchQuery> {
  const keywordSet = new Set<string>();
  for (const kw of state.keywords) keywordSet.add(kw);
  for (const tech of state.technologies) keywordSet.add(tech);
  for (const skill of state.skills) keywordSet.add(skill);
  for (const industry of state.industries) keywordSet.add(industry);
  for (const company of state.companyPreferences) keywordSet.add(company);
  if (state.internationalPreference) keywordSet.add("international");
  for (const type of state.companyTypes) {
    if (type !== "any") keywordSet.add(type);
  }

  return {
    role: state.targetRole,
    location: state.locations[0] ?? null,
    workMode: state.workModes[0] ?? null,
    level: state.seniority ? SENIORITY_TO_LEVEL[state.seniority] : null,
    keywords: [...keywordSet].slice(0, 10),
    limit,
  };
}
