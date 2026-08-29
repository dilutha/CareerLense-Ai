import type { PrioritizedSkillGap } from "@/lib/career/skill-gap-priority";
import { findCuratedResource } from "./resource-catalog";
import type { RoadmapStepPlan } from "./schemas";

const MAX_SKILL_STEPS = 4;

/**
 * Deterministically builds the roadmap's step list — priority order comes
 * entirely from lib/career/skill-gap-priority.ts (real market-demand
 * data), resource URLs come entirely from the hand-verified catalog.
 * Gemini is never involved in this function at all; it only narrates the
 * result afterward (see generate-roadmap.ts).
 */
export function buildRoadmapPlan(
  prioritizedGaps: PrioritizedSkillGap[],
  targetRole: string,
  level: string | null
): RoadmapStepPlan[] {
  const steps: RoadmapStepPlan[] = [];
  const topGaps = prioritizedGaps.slice(0, MAX_SKILL_STEPS);

  topGaps.forEach((gap, i) => {
    const resource = findCuratedResource(gap.skill);
    steps.push({
      stepOrder: i,
      title: `Learn ${gap.skill}`,
      skill: gap.skill,
      resourceType: resource?.type ?? "practice",
      resourceUrl: resource?.url ?? null,
      resourceNote: resource?.note ?? `Search for a well-reviewed beginner ${gap.skill} course — no specific link is verified for this skill yet.`,
      estimatedDurationText: gap.priority === "high" ? "~2-3 weeks (estimate)" : "~1-2 weeks (estimate)",
    });
  });

  if (topGaps.length > 0) {
    const primarySkill = topGaps[0].skill;
    steps.push({
      stepOrder: steps.length,
      title: `Build a project demonstrating ${primarySkill}`,
      skill: primarySkill,
      resourceType: "project",
      resourceUrl: null,
      resourceNote: "A small, real project you can add to your portfolio/GitHub and speak to in interviews.",
      estimatedDurationText: "~1-2 weeks (estimate)",
    });
  }

  steps.push({
    stepOrder: steps.length,
    title: `Apply to ${level ? `${level} ` : ""}${targetRole} roles`,
    skill: targetRole,
    resourceType: "practice",
    resourceUrl: null,
    resourceNote: "Use /jobs to search and CareerLens's CV tailoring + cover letter tools once you're ready.",
    estimatedDurationText: "Ongoing",
  });

  return steps;
}
