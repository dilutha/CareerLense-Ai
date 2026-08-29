import "server-only";
import { computeSessionSummary } from "@/lib/interview/session-summary";
import type { JobMatch } from "@/lib/jobs/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InterviewExchangeRow, InterviewSessionRow } from "@/lib/interview/types";
import { getGithubAnalysisScore } from "./sources/github-source";
import { getPortfolioReadinessScores } from "./sources/portfolio-source";
import { getResumeReadinessScore } from "./sources/resume-source";

export interface JobReadiness {
  cv: number | null;
  portfolio: number | null;
  github: number | null;
  skills: number | null;
  interview: number | null;
  strongest: { label: string; score: number } | null;
  weakest: { label: string; score: number } | null;
}

const LABELS: Record<string, string> = { cv: "CV", portfolio: "Portfolio", github: "GitHub", skills: "Skills" };

/**
 * Job-specific readiness — reuses the same general CV/Portfolio/GitHub
 * scores as the career dashboard (those aren't job-specific artifacts),
 * but Skills uses THIS job's own deterministic match.skills_score rather
 * than a cross-job average, and Interview only counts a session actually
 * tied to this job_id.
 */
export async function getJobReadiness(userId: string, jobId: string, match: JobMatch | null): Promise<JobReadiness> {
  const supabase = await createServerSupabaseClient();

  const [cv, portfolio, github, interviewSession] = await Promise.all([
    getResumeReadinessScore(userId),
    getPortfolioReadinessScores(userId),
    getGithubAnalysisScore(userId),
    supabase
      .from("interview_sessions")
      .select("*")
      .eq("profile_id", userId)
      .eq("job_id", jobId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let interview: number | null = null;
  if (interviewSession.data) {
    const { data: exchanges } = await supabase
      .from("interview_exchanges")
      .select("*")
      .eq("session_id", (interviewSession.data as InterviewSessionRow).id);
    interview = computeSessionSummary((exchanges ?? []) as InterviewExchangeRow[]).overall;
  }

  const skills = match?.skills_score ?? null;

  const scored = [
    { key: "cv", score: cv },
    { key: "portfolio", score: portfolio.overall },
    { key: "github", score: github },
    { key: "skills", score: skills },
  ].filter((c): c is { key: string; score: number } => c.score !== null);

  scored.sort((a, b) => b.score - a.score);

  return {
    cv,
    portfolio: portfolio.overall,
    github,
    skills,
    interview,
    strongest: scored[0] ? { label: LABELS[scored[0].key], score: scored[0].score } : null,
    weakest: scored[scored.length - 1]
      ? { label: LABELS[scored[scored.length - 1].key], score: scored[scored.length - 1].score }
      : null,
  };
}
