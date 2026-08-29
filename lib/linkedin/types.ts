import type { LINKEDIN_SCORE_CATEGORIES, LinkedInFinding } from "./schemas";

export interface LinkedInAnalysisRow {
  id: string;
  profile_id: string;
  content_hash: string;
  version_number: number;
  category_scores: Record<(typeof LINKEDIN_SCORE_CATEGORIES)[number], number>;
  overall_score: number | null;
  findings: LinkedInFinding[];
  created_at: string;
}

export interface LinkedInGeneratedContentRow {
  id: string;
  profile_id: string;
  linkedin_analysis_id: string | null;
  section: string;
  content: string;
  created_at: string;
}
