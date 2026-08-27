import type { JobAnalysisSkill } from "./schemas";

export type JobEmploymentType =
  | "internship"
  | "part_time"
  | "full_time"
  | "contract"
  | "freelance"
  | "volunteer"
  | "other";

export type JobWorkMode = "onsite" | "hybrid" | "remote";

export interface Job {
  id: string;
  source: string;
  source_job_id: string | null;
  title: string;
  company_name: string | null;
  location: string | null;
  country: string;
  employment_type: JobEmploymentType | null;
  work_mode: JobWorkMode | null;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  salary_text: string | null;
  application_url: string;
  source_url: string | null;
  posted_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  raw_data: Record<string, unknown> | null;
  normalized_data: Record<string, unknown> | null;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface JobSkillRow {
  id: string;
  job_id: string;
  skill_name: string;
  skill_type: JobAnalysisSkill["type"];
  importance: JobAnalysisSkill["importance"];
  created_at: string;
}

export interface MatchExplanation {
  positives: string[];
  gaps: string[];
}

export interface JobMatch {
  id: string;
  profile_id: string;
  job_id: string;
  resume_id: string | null;
  match_score: number;
  skills_score: number | null;
  role_score: number | null;
  experience_score: number | null;
  education_score: number | null;
  location_score: number | null;
  keyword_score: number | null;
  matched_skills: string[];
  missing_required_skills: string[];
  missing_preferred_skills: string[];
  matched_keywords: string[];
  missing_keywords: string[];
  explanation: MatchExplanation | null;
  created_at: string;
  updated_at: string;
}

export interface SavedJob {
  id: string;
  profile_id: string;
  job_id: string;
  created_at: string;
}

export type MatchCategory = "excellent" | "good" | "potential" | "weak";

export function matchCategory(score: number): MatchCategory {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "potential";
  return "weak";
}

export const MATCH_CATEGORY_LABEL: Record<MatchCategory, string> = {
  excellent: "Excellent match",
  good: "Good match",
  potential: "Potential match",
  weak: "Low match",
};

/** A job together with the current user's cached match, for display. */
export interface JobWithMatch {
  job: Job;
  skills: JobSkillRow[];
  match: JobMatch | null;
}
