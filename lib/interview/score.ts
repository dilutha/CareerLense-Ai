import { ANSWER_DIMENSION_WEIGHTS, ANSWER_QUALITY_DIMENSIONS, type AnswerFinding } from "./schemas";

const BASE_DIMENSION_SCORE = 70;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic "Answer Quality Score" from Gemini's per-dimension
 * findings — same base+impact pattern as resume/portfolio scoring.
 * Deliberately named "quality", not "success probability" — see
 * docs/AI_AGENT.md's Phase 10 section.
 */
export function computeAnswerQualityScore(findings: AnswerFinding[]): {
  overall: number;
  breakdown: Record<(typeof ANSWER_QUALITY_DIMENSIONS)[number], number>;
} {
  const breakdown = {} as Record<(typeof ANSWER_QUALITY_DIMENSIONS)[number], number>;

  for (const dimension of ANSWER_QUALITY_DIMENSIONS) {
    const delta = findings
      .filter((f) => f.dimension === dimension)
      .reduce((sum, f) => sum + f.impact, 0);
    breakdown[dimension] = Math.round(clamp(BASE_DIMENSION_SCORE + delta));
  }

  const overall = Math.round(
    ANSWER_QUALITY_DIMENSIONS.reduce(
      (sum, dimension) => sum + breakdown[dimension] * ANSWER_DIMENSION_WEIGHTS[dimension],
      0
    )
  );

  return { overall: clamp(overall), breakdown };
}
