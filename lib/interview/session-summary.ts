import { INTERVIEW_QUESTION_CATEGORIES, type InterviewQuestionCategory } from "./schemas";
import type { InterviewExchangeRow } from "./types";

export type SessionSummary = Partial<Record<InterviewQuestionCategory, number>> & { overall: number | null };

/**
 * Deterministic per-category rollup of a session's answered exchanges —
 * a category with zero answered questions is simply omitted (never
 * defaulted to 0), matching the project's "not analyzed isn't zero" rule.
 */
export function computeSessionSummary(exchanges: InterviewExchangeRow[]): SessionSummary {
  const answered = exchanges.filter((e) => e.quality_score !== null);
  const summary: SessionSummary = { overall: null };

  for (const category of INTERVIEW_QUESTION_CATEGORIES) {
    const inCategory = answered.filter((e) => e.category === category);
    if (inCategory.length === 0) continue;
    const avg = inCategory.reduce((sum, e) => sum + (e.quality_score ?? 0), 0) / inCategory.length;
    summary[category] = Math.round(avg);
  }

  if (answered.length > 0) {
    summary.overall = Math.round(
      answered.reduce((sum, e) => sum + (e.quality_score ?? 0), 0) / answered.length
    );
  }

  return summary;
}
