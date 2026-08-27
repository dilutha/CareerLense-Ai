import type { ResumeFinding, ResumeParsedData, ResumeScoreCategory } from "./schemas";

export type ResumeFileType = "pdf" | "docx";
export type ResumeStatus = "uploaded" | "processing" | "ready" | "failed";

export interface Resume {
  id: string;
  profile_id: string;
  name: string;
  original_filename: string;
  storage_path: string;
  file_type: ResumeFileType;
  file_size: number;
  status: ResumeStatus;
  error_message: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResumeVersion {
  id: string;
  resume_id: string;
  version_number: number;
  label: string | null;
  extracted_text: string | null;
  text_truncated: boolean;
  parsed_data: ResumeParsedData | null;
  created_at: string;
  updated_at: string;
}

export type ResumeScoreBreakdown = Record<ResumeScoreCategory, number>;

export interface ResumeAnalysis {
  id: string;
  resume_version_id: string;
  overall_score: number | null;
  score_breakdown: ResumeScoreBreakdown | null;
  summary: string | null;
  strengths: ResumeFinding[];
  weaknesses: ResumeFinding[];
  skills: ResumeParsedData["skills"];
  experience_summary: string | null;
  education_summary: string | null;
  projects: ResumeParsedData["projects"];
  missing_sections: string[];
  keyword_suggestions: string[];
  formatting_feedback: string[];
  created_at: string;
}

/** A resume together with its latest version and analysis, for display. */
export interface ResumeWithAnalysis {
  resume: Resume;
  version: ResumeVersion | null;
  analysis: ResumeAnalysis | null;
}
