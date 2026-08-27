import { RESUME_SCORE_CATEGORIES, type ResumeFinding } from "./schemas";
import type { ResumeAnalysis, ResumeScoreBreakdown } from "./types";
import type { GeminiResumeOutput } from "./schemas";

/** Every category starts here; Gemini's findings nudge it up or down. */
const BASE_CATEGORY_SCORE = 75;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Computes an explainable score deterministically from Gemini's findings,
 * rather than trusting an opaque number from the model directly (see
 * PROJECT_SPEC.md — "scoring must be explainable"). Each category's score
 * is a fixed base plus the sum of that category's finding impacts, clamped
 * to [0, 100]; the overall score is the average across categories.
 */
export function computeResumeScore(findings: ResumeFinding[]): {
  overall: number;
  breakdown: ResumeScoreBreakdown;
} {
  const breakdown = {} as ResumeScoreBreakdown;

  for (const category of RESUME_SCORE_CATEGORIES) {
    const delta = findings
      .filter((f) => f.category === category)
      .reduce((sum, f) => sum + f.impact, 0);
    breakdown[category] = Math.round(clamp(BASE_CATEGORY_SCORE + delta, 0, 100));
  }

  const overall = Math.round(
    RESUME_SCORE_CATEGORIES.reduce((sum, c) => sum + breakdown[c], 0) /
      RESUME_SCORE_CATEGORIES.length
  );

  return { overall, breakdown };
}

/**
 * Builds the row to insert into resume_analysis from Gemini's validated
 * output. Pure/synchronous — no Gemini call here, just deterministic
 * derivation.
 */
export function buildResumeAnalysisRecord(
  resumeVersionId: string,
  output: GeminiResumeOutput
): Omit<ResumeAnalysis, "id" | "created_at"> {
  const { overall, breakdown } = computeResumeScore(output.findings);

  return {
    resume_version_id: resumeVersionId,
    overall_score: overall,
    score_breakdown: breakdown,
    summary: output.summary,
    strengths: output.findings.filter((f) => f.impact > 0),
    weaknesses: output.findings.filter((f) => f.impact <= 0),
    skills: output.parsed.skills,
    experience_summary: output.experience_summary,
    education_summary: output.education_summary,
    projects: output.parsed.projects,
    missing_sections: output.parsed.missing_sections,
    keyword_suggestions: output.keyword_suggestions,
    formatting_feedback: output.formatting_feedback,
  };
}
