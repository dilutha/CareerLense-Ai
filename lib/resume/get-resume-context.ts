import "server-only";
import { getDefaultResume } from "./get-resumes";

const MAX_ITEMS = 8;

/**
 * Builds a compact RESUME CONTEXT block for the chat system instruction —
 * score, detected skills, and summarized strengths/weaknesses, never the
 * full extracted CV text (see docs/AI_AGENT.md for why). Returns null if
 * the user has no ready resume, so the caller can omit the section
 * entirely rather than sending an empty header.
 */
export async function buildResumeContext(userId: string): Promise<string | null> {
  const result = await getDefaultResume(userId);
  if (!result?.analysis) return null;

  const { resume, analysis } = result;
  const lines: string[] = ["RESUME CONTEXT:", `File: ${resume.name}`];

  if (analysis.overall_score != null) {
    lines.push(`CareerLens resume score: ${analysis.overall_score}/100`);
  }
  if (analysis.summary) {
    lines.push(`Summary: ${analysis.summary}`);
  }
  if (analysis.skills.length > 0) {
    lines.push(`Detected skills: ${analysis.skills.slice(0, MAX_ITEMS).map((s) => s.name).join(", ")}`);
  }
  if (analysis.strengths.length > 0) {
    lines.push(
      "Strengths: " +
        analysis.strengths.slice(0, MAX_ITEMS).map((f) => f.label).join("; ")
    );
  }
  if (analysis.weaknesses.length > 0) {
    lines.push(
      "Weaknesses: " +
        analysis.weaknesses.slice(0, MAX_ITEMS).map((f) => `${f.label} — ${f.explanation}`).join("; ")
    );
  }
  if (analysis.missing_sections.length > 0) {
    lines.push(`Missing sections: ${analysis.missing_sections.join(", ")}`);
  }

  return lines.join("\n");
}
