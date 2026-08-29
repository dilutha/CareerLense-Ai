import type { InterviewQuestionCategory } from "./schemas";

export type InterviewSessionStatus = "in_progress" | "completed";

export interface InterviewSessionRow {
  id: string;
  profile_id: string;
  job_id: string | null;
  status: InterviewSessionStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface InterviewExchangeRow {
  id: string;
  session_id: string;
  profile_id: string;
  category: InterviewQuestionCategory;
  question: string;
  order_index: number;
  answer_text: string | null;
  feedback: string | null;
  quality_score: number | null;
  score_breakdown: Record<string, number> | null;
  created_at: string;
  answered_at: string | null;
}

export interface InterviewSessionWithExchanges {
  session: InterviewSessionRow;
  exchanges: InterviewExchangeRow[];
}
