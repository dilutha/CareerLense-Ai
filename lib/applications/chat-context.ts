import "server-only";
import type { AnalyticsSummary } from "./analytics-summary";
import type { ApplicationStats } from "./stats";

/**
 * Compact APPLICATIONS CONTEXT for the chat system instruction — real,
 * already-computed numbers only (lib/applications/stats.ts,
 * analytics-summary.ts), never raw application rows or notes text (which
 * could contain sensitive personal detail — PROJECT_SPEC's Phase 11 data
 * privacy rule: "do not log/transmit personal notes" extends to not
 * sending them to Gemini either, beyond what's actually needed).
 */
export function buildApplicationsContext(stats: ApplicationStats, summary: AnalyticsSummary): string | null {
  if (stats.total === 0) return null;

  const lines = ["APPLICATIONS CONTEXT (real data — use these exact numbers, never estimate):"];
  lines.push(`Total tracked: ${stats.total}. Active: ${stats.active}. Interviews reached: ${stats.interviews}.`);
  lines.push(`Final rounds: ${stats.finalRounds}. Offers: ${stats.offers}. Rejected: ${stats.rejected}.`);
  if (stats.interviewRate !== null) lines.push(`Interview rate (of submitted applications): ${stats.interviewRate}%.`);
  if (stats.offerRate !== null) lines.push(`Offer rate: ${stats.offerRate}%.`);
  if (summary.averageMatchScore !== null) lines.push(`Average match score across tracked jobs: ${summary.averageMatchScore}%.`);
  if (summary.topAppliedRole) lines.push(`Most-applied role family: ${summary.topAppliedRole}.`);
  if (summary.topSkillGap) lines.push(`Most common missing required skill across tracked jobs: ${summary.topSkillGap}.`);

  lines.push(
    "",
    'Use these numbers directly when the user asks about their applications (e.g. "mage applications kohomada?"). Never invent a number not listed here — if asked for something not in this block (e.g. average response time), say honestly that there isn\'t enough data for that yet.'
  );

  return lines.join("\n");
}
