import { CURRENTLY_AT_OR_PAST_INTERVIEW } from "./schemas";
import type { ApplicationRow } from "./types";

export interface ResumePerformanceEntry {
  resumeId: string;
  resumeName: string;
  applications: number;
  interviews: number;
}

export interface ResumePerformanceResult {
  entries: ResumePerformanceEntry[];
  /** A plain, non-causal observation — only set when there are >=2 resumes with >=3 applications each, otherwise null (not enough data to say anything responsible). */
  observation: string | null;
}

const MIN_APPLICATIONS_FOR_OBSERVATION = 3;

/**
 * Groups applications by which ORIGINAL uploaded resume (Phase 6,
 * resumes.id) their tailored CV was based on — not the per-job tailored
 * version number (Phase 8's application_document_versions restart at 1
 * for every job, so comparing "version 1 vs version 2" across different
 * jobs wouldn't mean anything; the underlying source resume is the
 * meaningful unit here).
 */
export function computeResumePerformance(
  applications: ApplicationRow[],
  documentToResumeId: Map<string, string>,
  resumeNames: Map<string, string>
): ResumePerformanceResult {
  const byResume = new Map<string, { applications: number; interviews: number }>();

  for (const application of applications) {
    if (!application.application_document_id) continue;
    const resumeId = documentToResumeId.get(application.application_document_id);
    if (!resumeId) continue;

    const entry = byResume.get(resumeId) ?? { applications: 0, interviews: 0 };
    entry.applications += 1;
    if (CURRENTLY_AT_OR_PAST_INTERVIEW.includes(application.status)) entry.interviews += 1;
    byResume.set(resumeId, entry);
  }

  const entries: ResumePerformanceEntry[] = [...byResume.entries()]
    .map(([resumeId, counts]) => ({
      resumeId,
      resumeName: resumeNames.get(resumeId) ?? "Unnamed CV",
      ...counts,
    }))
    .sort((a, b) => b.applications - a.applications);

  let observation: string | null = null;
  const eligible = entries.filter((e) => e.applications >= MIN_APPLICATIONS_FOR_OBSERVATION);
  if (eligible.length >= 2) {
    const withRates = eligible.map((e) => ({ ...e, rate: e.interviews / e.applications }));
    withRates.sort((a, b) => b.rate - a.rate);
    const best = withRates[0];
    const worst = withRates[withRates.length - 1];
    if (best.rate > worst.rate) {
      observation = `"${best.resumeName}" has a higher interview rate (${Math.round(best.rate * 100)}%) than "${worst.resumeName}" (${Math.round(worst.rate * 100)}%) so far — an observed association based on your application history, not a guarantee it's the cause.`;
    }
  }

  return { entries, observation };
}
