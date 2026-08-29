import "server-only";
import { getApplicationsReadinessScore } from "./sources/applications-source";
import { getGithubAnalysisScore } from "./sources/github-source";
import { getInterviewReadinessScore } from "./sources/interview-source";
import { getLinkedInAnalysisScore } from "./sources/linkedin-source";
import { getPortfolioReadinessScores } from "./sources/portfolio-source";
import { getResumeReadinessScore } from "./sources/resume-source";
import { getSkillsReadinessScore } from "./sources/skills-source";
import { computeCareerReadiness, type CareerReadinessInput, type CareerReadinessResult } from "./readiness";
import { computeNextBestAction, type NextBestAction } from "./next-best-action";

export interface CareerReadinessSnapshot {
  readiness: CareerReadinessResult;
  nextBestAction: NextBestAction | null;
}

/**
 * Assembles the career-readiness snapshot live from each domain's latest
 * analysis — deliberately not persisted (see migration 006's header
 * comment for why). Every fetch runs in parallel and independently
 * returns null on "not analyzed yet" rather than throwing, so one missing
 * component never breaks the whole dashboard.
 */
export async function getCareerReadinessSnapshot(userId: string): Promise<CareerReadinessSnapshot> {
  const [cv, portfolio, skills, linkedin, github, interview, applications] = await Promise.all([
    getResumeReadinessScore(userId),
    getPortfolioReadinessScores(userId),
    getSkillsReadinessScore(userId),
    getLinkedInAnalysisScore(userId),
    getGithubAnalysisScore(userId),
    getInterviewReadinessScore(userId),
    getApplicationsReadinessScore(userId),
  ]);

  const input: CareerReadinessInput = {
    cv,
    portfolio: portfolio.overall,
    skills,
    projects: portfolio.projects,
    linkedin,
    github,
    interview,
    applications,
  };

  const readiness = computeCareerReadiness(input);
  const nextBestAction = computeNextBestAction(readiness);

  return { readiness, nextBestAction };
}
