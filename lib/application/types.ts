import type {
  SkillComparisonEntry,
  KeywordComparisonEntry,
  TailoredContent,
  TailoringNote,
} from "./schemas";

export type ApplicationStatus = "draft" | "ready";

export interface ApplicationDocument {
  id: string;
  profile_id: string;
  job_id: string;
  source_resume_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface ApplicationAnalysisRow {
  id: string;
  application_document_id: string;
  profile_id: string;
  skill_comparison: SkillComparisonEntry[];
  keyword_comparison: KeywordComparisonEntry[];
  overall_keyword_alignment: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDocumentVersion {
  id: string;
  application_document_id: string;
  profile_id: string;
  version_number: number;
  tailored_content: TailoredContent;
  tailoring_notes: TailoringNote[];
  keyword_alignment_before: number | null;
  keyword_alignment_after: number | null;
  created_at: string;
}

export interface CoverLetterRow {
  id: string;
  application_document_id: string;
  profile_id: string;
  version_number: number;
  content: string;
  created_at: string;
}

/** Everything the application dashboard needs for one job. */
export interface ApplicationBundle {
  document: ApplicationDocument | null;
  analysis: ApplicationAnalysisRow | null;
  latestCvVersion: ApplicationDocumentVersion | null;
  cvVersionHistory: ApplicationDocumentVersion[];
  latestCoverLetter: CoverLetterRow | null;
  coverLetterHistory: CoverLetterRow[];
}
