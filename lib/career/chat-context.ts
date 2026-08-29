import "server-only";
import type { CareerReadinessSnapshot } from "./get-career";

/**
 * Compact CAREER READINESS context for the chat system instruction —
 * structured summary only, never raw portfolio HTML / full GitHub repo
 * content / full resume text (those already have their own compact
 * context blocks — career-profile/resume — this one is specifically
 * about cross-domain readiness, see PROJECT_SPEC.md's Phase 10 "context
 * size" instruction).
 */
export function buildCareerReadinessContext(snapshot: CareerReadinessSnapshot): string | null {
  const { readiness, nextBestAction } = snapshot;
  if (readiness.analyzedComponents.length === 0) return null;

  const lines = ["CAREER READINESS CONTEXT:"];
  if (readiness.overall !== null) {
    lines.push(`Overall: ${readiness.overall}%${readiness.hasUnanalyzedComponents ? " (based on what's been analyzed so far)" : ""}`);
  }

  const labels: Record<string, string> = {
    cv: "CV",
    portfolio: "Portfolio",
    skills: "Skills",
    projects: "Projects",
    linkedin: "LinkedIn",
    github: "GitHub",
    interview: "Interview",
  };

  for (const component of readiness.analyzedComponents) {
    lines.push(`${labels[component]}: ${readiness.components[component]}%`);
  }

  const notAnalyzed = Object.entries(readiness.components)
    .filter(([, score]) => score === null)
    .map(([key]) => labels[key]);
  if (notAnalyzed.length > 0) {
    lines.push(`Not analyzed yet: ${notAnalyzed.join(", ")} — don't guess a score for these, say they haven't been checked yet.`);
  }

  if (nextBestAction) {
    lines.push(`Suggested next focus: ${nextBestAction.label} (${nextBestAction.reason})`);
  }

  return lines.join("\n");
}
