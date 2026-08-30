import { z } from "zod";

export const INTERVIEW_QUESTION_CATEGORIES = [
  "general",
  "technical",
  "behavioral",
  "project",
  "job_specific",
] as const;
export type InterviewQuestionCategory = (typeof INTERVIEW_QUESTION_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Question generation — grounded in VerifiedFacts (+ optional selected
// job). Gemini generates the question TEXT; nothing about the candidate
// is invented since it's only ever asked about facts given to it.
// ---------------------------------------------------------------------------

export const GeneratedQuestionSchema = z.object({
  category: z.enum(INTERVIEW_QUESTION_CATEGORIES),
  question: z.string(),
  /** For project/job_specific questions — what fact this question is grounded in, e.g. a project name. Null for general/behavioral. */
  groundedIn: z.string().nullable(),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const GeminiQuestionSetSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).min(1),
});
export type GeminiQuestionSet = z.infer<typeof GeminiQuestionSetSchema>;

/** One adaptively-generated next question (lib/interview/generate-next-question.ts) — the voice interview's one-at-a-time flow. */
export const NextQuestionSchema = GeneratedQuestionSchema.extend({
  /** True when this is a genuine follow-up to the candidate's most recent answer, not a fresh topic. */
  isFollowUp: z.boolean(),
});
export type NextQuestion = z.infer<typeof NextQuestionSchema>;

// ---------------------------------------------------------------------------
// Answer evaluation — same "Gemini finds, code scores" pattern. Explicitly
// does NOT include a "confidence" dimension — text alone can't measure
// human confidence, and the project rules forbid pretending it can.
// ---------------------------------------------------------------------------

export const ANSWER_QUALITY_DIMENSIONS = [
  "relevance",
  "structure",
  "clarity",
  "technical_accuracy",
  "conciseness",
] as const;

export const ANSWER_DIMENSION_WEIGHTS: Record<(typeof ANSWER_QUALITY_DIMENSIONS)[number], number> = {
  relevance: 0.25,
  structure: 0.2,
  clarity: 0.2,
  technical_accuracy: 0.25,
  conciseness: 0.1,
};

export const AnswerFindingSchema = z.object({
  dimension: z.enum(ANSWER_QUALITY_DIMENSIONS),
  impact: z.number().min(-15).max(15),
  note: z.string(),
});
export type AnswerFinding = z.infer<typeof AnswerFindingSchema>;

export const GeminiAnswerEvaluationSchema = z.object({
  findings: z.array(AnswerFindingSchema).min(1),
  /** What was good — specific to this answer. */
  strengths: z.array(z.string()).default([]),
  /** What to improve — specific, actionable. */
  improvements: z.array(z.string()).default([]),
  /** A stronger version of the answer — still using ONLY facts from VerifiedFacts/the question context, never inventing new experience. */
  improvedAnswer: z.string().nullable(),
  feedback: z.string(),
});
export type GeminiAnswerEvaluation = z.infer<typeof GeminiAnswerEvaluationSchema>;
