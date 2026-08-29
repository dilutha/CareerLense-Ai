import { PORTFOLIO_CATEGORY_WEIGHTS, PORTFOLIO_SCORE_CATEGORIES, type PortfolioFinding } from "./schemas";

const BASE_CATEGORY_SCORE = 75;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic, weighted score from Gemini's findings — same "base +
 * sum(impact), clamped" philosophy as lib/resume/analyze-resume.ts, but
 * weighted (20/25/20/15/10/10) rather than a flat average, per
 * PROJECT_SPEC.md's Phase 10 category weights. Gemini never sets the
 * number directly.
 */
export function computePortfolioScore(findings: PortfolioFinding[]): {
  overall: number;
  breakdown: Record<(typeof PORTFOLIO_SCORE_CATEGORIES)[number], number>;
} {
  const breakdown = {} as Record<(typeof PORTFOLIO_SCORE_CATEGORIES)[number], number>;

  for (const category of PORTFOLIO_SCORE_CATEGORIES) {
    const delta = findings
      .filter((f) => f.category === category)
      .reduce((sum, f) => sum + f.impact, 0);
    breakdown[category] = Math.round(clamp(BASE_CATEGORY_SCORE + delta));
  }

  const overall = Math.round(
    PORTFOLIO_SCORE_CATEGORIES.reduce(
      (sum, category) => sum + breakdown[category] * PORTFOLIO_CATEGORY_WEIGHTS[category],
      0
    )
  );

  return { overall: clamp(overall), breakdown };
}
