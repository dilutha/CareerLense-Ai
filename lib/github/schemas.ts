import { z } from "zod";

// ---------------------------------------------------------------------------
// Deterministic extraction from GitHub's public REST API — no Gemini.
// ---------------------------------------------------------------------------

export const GitHubRepoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number(),
  forks: z.number(),
  hasReadme: z.boolean(),
  isFork: z.boolean(),
  updatedAt: z.string().nullable(),
  url: z.string(),
});
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

export const GitHubProfileDataSchema = z.object({
  username: z.string(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  publicRepoCount: z.number(),
  followers: z.number(),
  hasProfileReadme: z.boolean(),
  repos: z.array(GitHubRepoSchema),
});
export type GitHubProfileData = z.infer<typeof GitHubProfileDataSchema>;

// ---------------------------------------------------------------------------
// Evaluative findings — same "Gemini finds, code scores" pattern as
// portfolio/resume analysis.
// ---------------------------------------------------------------------------

export const GITHUB_SCORE_CATEGORIES = [
  "profile_completeness",
  "repository_quality",
  "career_relevance",
  "documentation",
  "activity",
] as const;

export const GITHUB_CATEGORY_WEIGHTS: Record<(typeof GITHUB_SCORE_CATEGORIES)[number], number> = {
  profile_completeness: 0.15,
  repository_quality: 0.25,
  career_relevance: 0.3,
  documentation: 0.2,
  activity: 0.1,
};

export const GitHubFindingSchema = z.object({
  label: z.string(),
  category: z.enum(GITHUB_SCORE_CATEGORIES),
  severity: z.enum(["critical", "high", "medium", "low", "good"]),
  impact: z.number().min(-15).max(15),
  explanation: z.string(),
});
export type GitHubFinding = z.infer<typeof GitHubFindingSchema>;

export const GitHubProjectRecommendationSchema = z.object({
  title: z.string(),
  reason: z.string(),
  skillsAddressed: z.array(z.string()).default([]),
});

export const GeminiGitHubOutputSchema = z.object({
  findings: z.array(GitHubFindingSchema).min(1),
  recommendedProjects: z.array(GitHubProjectRecommendationSchema).default([]),
  summary: z.string().nullable(),
});
export type GeminiGitHubOutput = z.infer<typeof GeminiGitHubOutputSchema>;
