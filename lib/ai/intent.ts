import type { CareerIntent } from "./types";

/**
 * Lightweight keyword heuristic used only for server-side logging. It does
 * NOT alter what's sent to Gemini — the model handles the actual
 * conversation via the system prompt. This exists to prepare the
 * architecture for real intent-driven tool routing in a later phase.
 */
export function detectCareerIntent(text: string): CareerIntent {
  const t = text.toLowerCase().trim();

  if (t.length < 3) return "unknown";
  if (/internship/.test(t)) return "internship_search";
  if (/\bjob\b|vacan/.test(t)) return "job_search";
  if (/\bcv\b|resume/.test(t)) return "resume_review";
  if (/portfolio/.test(t)) return "portfolio_review";
  if (/interview/.test(t)) return "interview_prep";
  if (/cover letter/.test(t)) return "cover_letter";
  if (/\bmatch\b/.test(t)) return "job_match";
  if (/\bskill/.test(t)) return "skill_gap";
  if (/career|future|plan/.test(t)) return "career_planning";
  return "general_career";
}
