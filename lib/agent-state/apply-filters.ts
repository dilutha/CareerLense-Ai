import type { JobWithMatch } from "@/lib/jobs/types";
import type { CareerAgentState } from "./schema";

function textIncludesAny(haystack: string | null, needles: string[]): boolean {
  if (!haystack || needles.length === 0) return false;
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

/**
 * Deterministic, honest hard filtering (Part 17) — only ever checks REAL
 * fields the job data actually has (title, company_name, work_mode).
 * excludedIndustries has no structured `industry` column to check against
 * (no source provides one — see docs/JOB_DATA.md), so it degrades to a
 * best-effort keyword check against the title, same as excludedRoles —
 * documented here rather than silently pretended to be precise.
 *
 * Also drops anything already shown (Part 20's "show more" dedup) when
 * `excludeJobIds` is given.
 */
export function applyConversationalFilters(
  ranked: JobWithMatch[],
  state: CareerAgentState,
  excludeJobIds: string[] = []
): JobWithMatch[] {
  const excludeSet = new Set(excludeJobIds);

  return ranked.filter((item) => {
    if (excludeSet.has(item.job.id)) return false;

    if (textIncludesAny(item.job.title, state.excludedRoles)) return false;
    if (textIncludesAny(item.job.title, state.excludedIndustries)) return false;
    if (textIncludesAny(item.job.company_name, state.excludedCompanies)) return false;
    if (item.job.work_mode && (state.excludedWorkModes as string[]).includes(item.job.work_mode)) return false;

    return true;
  });
}
