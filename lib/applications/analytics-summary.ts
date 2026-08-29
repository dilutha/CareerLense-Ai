import { findRoleFamily } from "@/lib/jobs/role-taxonomy";
import type { Job, JobMatch } from "@/lib/jobs/types";

export interface AnalyticsSummary {
  averageMatchScore: number | null;
  topAppliedRole: string | null;
  topSkillGap: string | null;
}

/**
 * Deterministic top-line analytics — averages/counts over real stored
 * match scores and missing_required_skills, never a Gemini estimate.
 * Every field is null (not 0/"Unknown") when there isn't enough data.
 */
export function computeAnalyticsSummary(
  jobs: Job[],
  matches: Map<string, JobMatch>
): AnalyticsSummary {
  const scores = jobs.map((j) => matches.get(j.id)?.match_score).filter((s): s is number => s != null);
  const averageMatchScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

  const roleCounts = new Map<string, number>();
  for (const job of jobs) {
    const family = findRoleFamily(job.title) ?? job.title;
    roleCounts.set(family, (roleCounts.get(family) ?? 0) + 1);
  }
  const topAppliedRole =
    roleCounts.size > 0 ? [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;

  const skillGapCounts = new Map<string, number>();
  for (const job of jobs) {
    const match = matches.get(job.id);
    for (const skill of match?.missing_required_skills ?? []) {
      skillGapCounts.set(skill, (skillGapCounts.get(skill) ?? 0) + 1);
    }
  }
  const topSkillGap =
    skillGapCounts.size > 0 ? [...skillGapCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;

  return { averageMatchScore, topAppliedRole, topSkillGap };
}
