import { classifyFreshness, type FreshnessLabel } from "./freshness";
import { getSourceConfidence, type SourceConfidence } from "./source-confidence";
import { matchCategory, type JobWithMatch } from "./types";

/**
 * Per-dimension sub-scores, straight from the already-computed
 * deterministic match (lib/jobs/match.ts) — never a second calculation.
 * Null when there's no match row at all (e.g. an unmatched/demo listing).
 */
export interface MatchScoreBreakdown {
  skills: number | null;
  role: number | null;
  experience: number | null;
  education: number | null;
  location: number | null;
  keywords: number | null;
}

/** Compact job shape sent over the wire to the browser and rendered as a JobCard. */
export interface JobResultSummary {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  workMode: string | null;
  employmentType: string | null;
  postedAt: string | null;
  freshness: FreshnessLabel;
  matchScore: number;
  matchCategory: string;
  matchBreakdown: MatchScoreBreakdown;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  applicationUrl: string;
  sourceUrl: string | null;
  source: string;
  sourceName: string;
  sourceConfidence: SourceConfidence;
  isDemo: boolean;
  duplicateOf: string | null;
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
    freshness: classifyFreshness(item.job.posted_at, item.job.first_seen_at),
    matchScore: item.match?.match_score ?? 0,
    matchCategory: matchCategory(item.match?.match_score ?? 0),
    matchBreakdown: {
      skills: item.match?.skills_score ?? null,
      role: item.match?.role_score ?? null,
      experience: item.match?.experience_score ?? null,
      education: item.match?.education_score ?? null,
      location: item.match?.location_score ?? null,
      keywords: item.match?.keyword_score ?? null,
    },
    matchedSkills: item.match?.matched_skills ?? [],
    missingRequiredSkills: item.match?.missing_required_skills ?? [],
    applicationUrl: item.job.application_url,
    sourceUrl: item.job.source_url,
    source: item.job.source,
    sourceName: item.job.source_name ?? item.job.source,
    sourceConfidence: getSourceConfidence(item.job.source_type),
    isDemo,
    duplicateOf: item.job.duplicate_of,
  };
}

/**
 * Compact JOB SEARCH RESULTS text block for the Gemini chat context.
 * Includes each job's real database ID so the model can reference a
 * specific job precisely (e.g. answering "why does job 2 match?") rather
 * than relying on positional guesswork alone — see docs/AI_AGENT.md.
 */
export function buildJobResultsContext(summaries: JobResultSummary[]): string | null {
  if (summaries.length === 0) return null;

  const lines = ["JOB SEARCH RESULTS (just found, shown to the user as cards):"];
  summaries.forEach((job, i) => {
    const bits = [
      `${i + 1}. [id:${job.id}] ${job.title}${job.company ? ` at ${job.company}` : ""}`,
      job.location ? `(${job.location}${job.workMode ? `, ${job.workMode}` : ""})` : "",
      `— ${job.matchScore}% match, source: ${job.isDemo ? "Demo Data" : job.sourceName}`,
    ];
    lines.push(bits.filter(Boolean).join(" "));
    if (job.matchedSkills.length > 0) {
      lines.push(`   Matches: ${job.matchedSkills.slice(0, 5).join(", ")}`);
    }
    if (job.missingRequiredSkills.length > 0) {
      lines.push(`   Missing required: ${job.missingRequiredSkills.slice(0, 5).join(", ")}`);
    }
  });

  const demoCount = summaries.filter((j) => j.isDemo).length;
  if (demoCount === summaries.length) {
    lines.push(
      "",
      "Note: these are ALL demo/fixture listings (no live job source configured yet) — mention this naturally if asked, don't present them as real live vacancies."
    );
  } else if (demoCount > 0) {
    lines.push(
      "",
      `Note: ${demoCount} of these ${summaries.length} results are demo/fixture listings, clearly marked above — only the ones marked "Demo Data" aren't real.`
    );
  }

  lines.push(
    "",
    'When the user refers to a job from this list (e.g. "the first one", "tailor CV for job 2"), use the [id:...] tag above to identify it precisely in your own reasoning — never guess an id, and never state one back to the user (it\'s an internal reference, not something they typed).'
  );

  return lines.join("\n");
}
