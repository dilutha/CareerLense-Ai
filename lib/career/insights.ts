import "server-only";
import type { PrioritizedSkillGap } from "./skill-gap-priority";
import type { ApplicationStats } from "@/lib/applications/stats";
import type { ResumePerformanceResult } from "@/lib/applications/resume-performance";

export interface CareerInsight {
  text: string;
  actionLabel: string;
  actionHref: string;
}

/**
 * Computed live from already-fetched data on every dashboard render — no
 * "career_insights" table (see migration 008's header comment for why:
 * same "compute live" pattern as career readiness). Each insight only
 * appears when the underlying real data actually supports it — never a
 * generic filler card.
 */
export function computeCareerInsights(input: {
  topSkillGap: PrioritizedSkillGap | null;
  applicationStats: ApplicationStats;
  resumePerformance: ResumePerformanceResult;
}): CareerInsight[] {
  const insights: CareerInsight[] = [];

  if (input.topSkillGap) {
    insights.push({
      text: `${input.topSkillGap.skill} is your highest-priority skill gap — ${input.topSkillGap.demandPercent}% of your matched jobs mention it.`,
      actionLabel: "Build Learning Plan",
      actionHref: "/career/roadmap",
    });
  }

  if (input.applicationStats.interviewRate !== null && input.applicationStats.interviewRate >= 25) {
    insights.push({
      text: `Your applications are converting to interviews at a ${input.applicationStats.interviewRate}% rate — keep applying with this approach.`,
      actionLabel: "View Applications",
      actionHref: "/applications",
    });
  }

  if (input.resumePerformance.observation) {
    insights.push({
      text: input.resumePerformance.observation,
      actionLabel: "View Resume Performance",
      actionHref: "/analytics",
    });
  }

  return insights;
}
