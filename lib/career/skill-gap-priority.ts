import type { ClassifiedSkill } from "./market-skills";

export type PriorityLevel = "high" | "medium" | "low";

export interface PrioritizedSkillGap {
  skill: string;
  priority: PriorityLevel;
  demandPercent: number;
  reason: string;
}

const HIGH_PRIORITY_THRESHOLD = 50;
const MEDIUM_PRIORITY_THRESHOLD = 25;

/**
 * Deterministic priority for missing/developing skills — driven primarily
 * by real, stored market demand percentage (lib/career/market-skills.ts),
 * never a Gemini-assigned priority. "developing" (partial/related
 * evidence already exists) is ranked below an equally-demanded "missing"
 * skill — closing a smaller gap first is a reasonable, explainable tie-break.
 */
export function prioritizeSkillGaps(classified: ClassifiedSkill[]): PrioritizedSkillGap[] {
  return classified
    .filter((s) => s.classification === "missing" || s.classification === "developing")
    .map((s) => {
      const priority: PriorityLevel =
        s.demandPercent >= HIGH_PRIORITY_THRESHOLD
          ? "high"
          : s.demandPercent >= MEDIUM_PRIORITY_THRESHOLD
            ? "medium"
            : "low";

      const reason =
        s.classification === "developing"
          ? `You already have related evidence (${s.relatedSkillFound}) — ${s.demandPercent}% of matched jobs mention ${s.skill}.`
          : `${s.demandPercent}% of your matched jobs mention ${s.skill}.`;

      return { skill: s.skill, priority, demandPercent: s.demandPercent, reason };
    })
    .sort((a, b) => b.demandPercent - a.demandPercent);
}
