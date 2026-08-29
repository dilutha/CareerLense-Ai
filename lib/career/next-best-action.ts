import { CAREER_READINESS_WEIGHTS, type CareerReadinessComponent, type CareerReadinessResult } from "./readiness";

const COMPONENT_LABELS: Record<CareerReadinessComponent, string> = {
  cv: "your CV",
  portfolio: "your portfolio",
  skills: "your skill coverage",
  projects: "your project evidence",
  linkedin: "your LinkedIn profile",
  github: "your GitHub profile",
  interview: "interview practice",
  applications: "your application activity",
};

/** An analyzed component scoring at or above this is "already solid" —
 *  used only to decide whether to fall back to recommending interview
 *  practice (see below), not for the primary ranking. */
const GOOD_ENOUGH_SCORE = 85;

export interface NextBestAction {
  component: CareerReadinessComponent;
  label: string;
  reason: string;
}

/**
 * Deterministic recommendation: among ANALYZED components, the one whose
 * weight × (100 - score) is largest — the biggest realistic improvement
 * lever, not just the lowest raw score (a low-weight component scoring
 * low matters less than a high-weight one scoring only slightly low).
 * Not-analyzed components are excluded from ranking, never treated as a
 * score of 0 (PROJECT_SPEC's own acceptance test: "do not calculate
 * missing interview as zero").
 */
export function computeNextBestAction(readiness: CareerReadinessResult): NextBestAction | null {
  if (readiness.analyzedComponents.length === 0) return null;

  // Everything analyzed is already strong on its own terms — if interview
  // hasn't been evaluated yet, that's the more useful next step even
  // though its weight (5%) would rarely win the impact ranking below
  // (PROJECT_SPEC's "all good but interview readiness low" example).
  const everythingAnalyzedIsSolid = readiness.analyzedComponents.every(
    (component) => (readiness.components[component] as number) >= GOOD_ENOUGH_SCORE
  );
  if (everythingAnalyzedIsSolid && readiness.components.interview === null) {
    return {
      component: "interview",
      label: COMPONENT_LABELS.interview,
      reason: "Everything else you've analyzed is already solid — interview practice is the piece you haven't tried yet.",
    };
  }

  const scored = readiness.analyzedComponents.map((component) => {
    const score = readiness.components[component] as number;
    const weight = CAREER_READINESS_WEIGHTS[component];
    return { component, score, impact: weight * (100 - score) };
  });

  scored.sort((a, b) => b.impact - a.impact);
  const best = scored[0];

  return {
    component: best.component,
    label: COMPONENT_LABELS[best.component],
    reason: `${COMPONENT_LABELS[best.component]} has the most room to improve relative to how much it counts toward your overall readiness.`,
  };
}
