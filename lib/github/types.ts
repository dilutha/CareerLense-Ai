import type { GITHUB_SCORE_CATEGORIES, GitHubFinding } from "./schemas";

export interface GitHubAnalysisRow {
  id: string;
  profile_id: string;
  github_username: string;
  content_hash: string;
  version_number: number;
  category_scores: Record<(typeof GITHUB_SCORE_CATEGORIES)[number], number>;
  overall_score: number | null;
  findings: GitHubFinding[];
  recommended_projects: { title: string; reason: string; skillsAddressed: string[] }[];
  created_at: string;
}
