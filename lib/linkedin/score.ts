import { LINKEDIN_CATEGORY_WEIGHTS, LINKEDIN_SCORE_CATEGORIES, type LinkedInFinding } from "./schemas";

const BASE_CATEGORY_SCORE = 75;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function computeLinkedInScore(findings: LinkedInFinding[]): {
  overall: number;
  breakdown: Record<(typeof LINKEDIN_SCORE_CATEGORIES)[number], number>;
} {
  const breakdown = {} as Record<(typeof LINKEDIN_SCORE_CATEGORIES)[number], number>;

  for (const category of LINKEDIN_SCORE_CATEGORIES) {
    const delta = findings
      .filter((f) => f.category === category)
      .reduce((sum, f) => sum + f.impact, 0);
    breakdown[category] = Math.round(clamp(BASE_CATEGORY_SCORE + delta));
  }

  const overall = Math.round(
    LINKEDIN_SCORE_CATEGORIES.reduce(
      (sum, category) => sum + breakdown[category] * LINKEDIN_CATEGORY_WEIGHTS[category],
      0
    )
  );

  return { overall: clamp(overall), breakdown };
}
