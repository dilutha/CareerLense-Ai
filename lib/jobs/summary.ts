import { matchCategory, type JobWithMatch } from "./types";

/** Compact job shape sent over the wire to the browser and rendered as a JobCard. */
export interface JobResultSummary {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  workMode: string | null;
  employmentType: string | null;
  postedAt: string | null;
  matchScore: number;
  matchCategory: string;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  applicationUrl: string;
  source: string;
  isDemo: boolean;
}

export function toJobResultSummary(item: JobWithMatch, isDemo: boolean): JobResultSummary {
  return {
    id: item.job.id,
    title: item.job.title,
    company: item.job.company_name,
    location: item.job.location,
    workMode: item.job.work_mode,
    employmentType: item.job.employment_type,
    postedAt: item.job.posted_at,
    matchScore: item.match?.match_score ?? 0,
    matchCategory: matchCategory(item.match?.match_score ?? 0),
    matchedSkills: item.match?.matched_skills ?? [],
    missingRequiredSkills: item.match?.missing_required_skills ?? [],
    applicationUrl: item.job.application_url,
    source: item.job.source,
    isDemo,
  };
}

/** Compact JOB SEARCH RESULTS text block for the Gemini chat context. */
export function buildJobResultsContext(summaries: JobResultSummary[]): string | null {
  if (summaries.length === 0) return null;

  const lines = ["JOB SEARCH RESULTS (just found, shown to the user as cards):"];
  summaries.forEach((job, i) => {
    const bits = [
      `${i + 1}. ${job.title}${job.company ? ` at ${job.company}` : ""}`,
      job.location ? `(${job.location}${job.workMode ? `, ${job.workMode}` : ""})` : "",
      `— ${job.matchScore}% match`,
    ];
    lines.push(bits.filter(Boolean).join(" "));
    if (job.matchedSkills.length > 0) {
      lines.push(`   Matches: ${job.matchedSkills.slice(0, 5).join(", ")}`);
    }
    if (job.missingRequiredSkills.length > 0) {
      lines.push(`   Missing required: ${job.missingRequiredSkills.slice(0, 5).join(", ")}`);
    }
  });
  if (summaries.some((j) => j.isDemo)) {
    lines.push(
      "",
      "Note: these are demo/fixture listings (no live job search provider is configured yet) — mention this naturally if asked, don't present them as real live vacancies."
    );
  }

  return lines.join("\n");
}
