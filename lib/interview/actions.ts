"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVerifiedFacts } from "@/lib/application/verified-facts";
import { getOptionalUser } from "@/lib/auth/require-user";
import { ensureProfileExists } from "@/lib/career-profile/ensure-profile";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getDefaultResume } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/jobs/types";
import { evaluateInterviewAnswer } from "./evaluate-answer";
import { generateInterviewQuestions } from "./generate-questions";
import { generateNextInterviewQuestion, type AnsweredTurn } from "./generate-next-question";
import { computeAnswerQualityScore } from "./score";
import type { InterviewExchangeRow } from "./types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

/** Starts a new mock interview session, optionally tied to a selected job. */
export async function startInterviewSession(
  jobId?: string
): Promise<ActionResult & { sessionId?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return startInterviewSessionCore(user.id, supabase, jobId);
}

/** Extracted for /api/v1/interview/questions — same reasoning as lib/resume/actions.ts#processResumeCore. */
export async function startInterviewSessionCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  jobId?: string
): Promise<ActionResult & { sessionId?: string }> {
  await ensureProfileExists(userId, supabase);
  const [profile, resume, jobResult] = await Promise.all([
    getCareerProfile(userId),
    getDefaultResume(userId),
    jobId
      ? supabase.from("jobs").select("*").eq("id", jobId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!profile && !resume) {
    return {
      success: false,
      error: "Complete your profile or upload a CV first so questions can be grounded in something real.",
    };
  }

  const facts = buildVerifiedFacts(profile, resume?.version ?? null);
  const job = (jobResult.data as Job | null) ?? null;

  let questions;
  try {
    questions = await generateInterviewQuestions(facts, job);
  } catch (error) {
    console.error(
      "[interview] Question generation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't prepare interview questions right now. Try again." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .insert({ profile_id: userId, job_id: job?.id ?? null, status: "in_progress" })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("[interview] Creating session failed:", sessionError?.message);
    return { success: false, error: "Couldn't start the interview session. Try again." };
  }

  const sessionId = (session as { id: string }).id;

  const exchangeRows = questions.map((q, i) => ({
    session_id: sessionId,
    profile_id: userId,
    category: q.category,
    question: q.question,
    order_index: i,
  }));

  const { error: exchangesError } = await supabase.from("interview_exchanges").insert(exchangeRows);
  if (exchangesError) {
    console.error("[interview] Saving questions failed:", exchangesError.message);
    return { success: false, error: "Prepared questions but couldn't save them. Try again." };
  }

  revalidatePath("/interview");
  return { success: true, sessionId };
}

/** Submits and evaluates one answer within a session. */
export interface SubmitAnswerResult extends ActionResult {
  feedback?: string;
  qualityScore?: number;
  scoreBreakdown?: Record<string, number>;
}

export async function submitInterviewAnswer(
  exchangeId: string,
  answerText: string
): Promise<SubmitAnswerResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return submitInterviewAnswerCore(user.id, supabase, exchangeId, answerText);
}

/** Extracted for /api/v1/interview/answer-review — same reasoning as lib/resume/actions.ts#processResumeCore. */
export async function submitInterviewAnswerCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  exchangeId: string,
  answerText: string
): Promise<SubmitAnswerResult> {
  const trimmed = answerText.trim();
  if (trimmed.length < 5) {
    return { success: false, error: "That's too short — give it a real attempt." };
  }

  const { data: exchange } = await supabase
    .from("interview_exchanges")
    .select("*")
    .eq("id", exchangeId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!exchange) return { success: false, error: "Couldn't find that question." };
  const row = exchange as { question: string };

  const [profile, resume] = await Promise.all([getCareerProfile(userId), getDefaultResume(userId)]);
  const facts = buildVerifiedFacts(profile, resume?.version ?? null);

  let evaluation;
  try {
    evaluation = await evaluateInterviewAnswer(row.question, trimmed, facts);
  } catch (error) {
    console.error(
      "[interview] Answer evaluation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't evaluate that answer right now. Try again." };
  }

  const { overall, breakdown } = computeAnswerQualityScore(evaluation.findings);

  const feedbackParts = [evaluation.feedback];
  if (evaluation.strengths.length > 0) feedbackParts.push(`Good: ${evaluation.strengths.join("; ")}`);
  if (evaluation.improvements.length > 0) feedbackParts.push(`Improve: ${evaluation.improvements.join("; ")}`);
  if (evaluation.improvedAnswer) feedbackParts.push(`Try instead: ${evaluation.improvedAnswer}`);

  const { error } = await supabase
    .from("interview_exchanges")
    .update({
      answer_text: trimmed,
      feedback: feedbackParts.join("\n\n"),
      quality_score: overall,
      score_breakdown: breakdown,
      answered_at: new Date().toISOString(),
    })
    .eq("id", exchangeId)
    .eq("profile_id", userId);

  if (error) {
    console.error("[interview] Saving answer failed:", error.message);
    return { success: false, error: "Evaluated it, but couldn't save the result. Try again." };
  }

  revalidatePath("/interview");
  return {
    success: true,
    feedback: feedbackParts.join("\n\n"),
    qualityScore: overall,
    scoreBreakdown: breakdown,
  };
}

export async function completeInterviewSession(sessionId: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("interview_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't complete the session." };

  revalidatePath("/interview");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Adaptive, one-question-at-a-time flow — the voice interview (Phase 3).
// Reuses everything above (VerifiedFacts, evaluateInterviewAnswer,
// computeAnswerQualityScore, the same interview_sessions/interview_exchanges
// tables) — the only new piece is HOW questions are generated: one at a
// time via generateNextInterviewQuestion, instead of the whole set
// upfront via generateInterviewQuestions. A session row's `status`/table
// shape is identical either way, so the existing text-mode UI and
// summary logic (computeSessionSummary) work unchanged for either kind of
// session — the two modes coexist without any schema branching.
// ---------------------------------------------------------------------------

/** Deterministic — Gemini decides WHAT to ask next, never WHETHER to keep going. Keeps a spoken interview to a reasonable, real-world length. */
const MAX_ADAPTIVE_QUESTIONS = 6;

export interface AdaptiveQuestionResult extends ActionResult {
  sessionId?: string;
  exchangeId?: string;
  category?: string;
  question?: string;
  isFollowUp?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
}

/** Starts an adaptive session: creates the session row and generates only the FIRST question. */
export async function startAdaptiveInterviewSession(jobId?: string): Promise<AdaptiveQuestionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return startAdaptiveInterviewSessionCore(user.id, supabase, jobId);
}

export async function startAdaptiveInterviewSessionCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  jobId?: string
): Promise<AdaptiveQuestionResult> {
  await ensureProfileExists(userId, supabase);
  const [profile, resume, jobResult] = await Promise.all([
    getCareerProfile(userId),
    getDefaultResume(userId),
    jobId ? supabase.from("jobs").select("*").eq("id", jobId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  if (!profile && !resume) {
    return {
      success: false,
      error: "Complete your profile or upload a CV first so questions can be grounded in something real.",
    };
  }

  const facts = buildVerifiedFacts(profile, resume?.version ?? null);
  const job = (jobResult.data as Job | null) ?? null;

  let question;
  try {
    question = await generateNextInterviewQuestion(facts, job, []);
  } catch (error) {
    console.error(
      "[interview] Adaptive question generation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't prepare interview questions right now. Try again." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .insert({ profile_id: userId, job_id: job?.id ?? null, status: "in_progress" })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("[interview] Creating adaptive session failed:", sessionError?.message);
    return { success: false, error: "Couldn't start the interview session. Try again." };
  }

  const sessionId = (session as { id: string }).id;

  const { data: exchange, error: exchangeError } = await supabase
    .from("interview_exchanges")
    .insert({
      session_id: sessionId,
      profile_id: userId,
      category: question.category,
      question: question.question,
      order_index: 0,
    })
    .select("id")
    .single();

  if (exchangeError || !exchange) {
    console.error("[interview] Saving first adaptive question failed:", exchangeError?.message);
    return { success: false, error: "Prepared a question but couldn't save it. Try again." };
  }

  revalidatePath("/interview");
  return {
    success: true,
    sessionId,
    exchangeId: (exchange as { id: string }).id,
    category: question.category,
    question: question.question,
    isFollowUp: false,
    questionNumber: 1,
    totalQuestions: MAX_ADAPTIVE_QUESTIONS,
  };
}

function toEvaluationSummary(qualityScore: number, feedback: string): string {
  // A short note for the NEXT generation call's context — not the full
  // feedback shown to the user, just enough for Gemini to judge whether a
  // follow-up is worth asking. Truncated so the growing transcript stays
  // a reasonable prompt size across a multi-question session.
  const firstSentence = feedback.split(/(?<=[.!?])\s/)[0] ?? feedback;
  return `Quality ${qualityScore}%. ${firstSentence}`.slice(0, 200);
}

/** Submits and evaluates the current answer, then either generates the next question or finishes the session. */
export async function submitAdaptiveAnswer(
  sessionId: string,
  exchangeId: string,
  answerText: string
): Promise<AdaptiveQuestionResult & { finished?: boolean }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return submitAdaptiveAnswerCore(user.id, supabase, sessionId, exchangeId, answerText);
}

export async function submitAdaptiveAnswerCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  sessionId: string,
  exchangeId: string,
  answerText: string
): Promise<AdaptiveQuestionResult & { finished?: boolean }> {
  const trimmed = answerText.trim();
  if (trimmed.length < 5) {
    return { success: false, error: "That's too short — give it a real attempt." };
  }

  const { data: sessionRow } = await supabase
    .from("interview_sessions")
    .select("id, job_id")
    .eq("id", sessionId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!sessionRow) return { success: false, error: "Couldn't find that interview session." };

  const { data: exchange } = await supabase
    .from("interview_exchanges")
    .select("*")
    .eq("id", exchangeId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!exchange) return { success: false, error: "Couldn't find that question." };
  const currentRow = exchange as InterviewExchangeRow;

  const [profile, resume] = await Promise.all([getCareerProfile(userId), getDefaultResume(userId)]);
  const facts = buildVerifiedFacts(profile, resume?.version ?? null);

  let evaluation;
  try {
    evaluation = await evaluateInterviewAnswer(currentRow.question, trimmed, facts);
  } catch (error) {
    console.error(
      "[interview] Adaptive answer evaluation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Couldn't evaluate that answer right now. Try again." };
  }

  const { overall, breakdown } = computeAnswerQualityScore(evaluation.findings);
  const feedbackParts = [evaluation.feedback];
  if (evaluation.strengths.length > 0) feedbackParts.push(`Good: ${evaluation.strengths.join("; ")}`);
  if (evaluation.improvements.length > 0) feedbackParts.push(`Improve: ${evaluation.improvements.join("; ")}`);
  const feedback = feedbackParts.join("\n\n");

  const { error: updateError } = await supabase
    .from("interview_exchanges")
    .update({
      answer_text: trimmed,
      feedback,
      quality_score: overall,
      score_breakdown: breakdown,
      answered_at: new Date().toISOString(),
    })
    .eq("id", exchangeId)
    .eq("profile_id", userId);

  if (updateError) {
    console.error("[interview] Saving adaptive answer failed:", updateError.message);
    return { success: false, error: "Evaluated it, but couldn't save the result. Try again." };
  }

  const { data: allExchanges } = await supabase
    .from("interview_exchanges")
    .select("*")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });
  const answered = ((allExchanges ?? []) as InterviewExchangeRow[]).filter((e) => e.answer_text !== null);

  if (answered.length >= MAX_ADAPTIVE_QUESTIONS) {
    const { error: completeError } = await supabase
      .from("interview_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("profile_id", userId);
    if (completeError) console.error("[interview] Completing adaptive session failed:", completeError.message);

    revalidatePath("/interview");
    return { success: true, finished: true, questionNumber: answered.length, totalQuestions: MAX_ADAPTIVE_QUESTIONS };
  }

  const history: AnsweredTurn[] = answered.map((e) => ({
    question: e.question,
    answer: e.answer_text ?? "",
    evaluationSummary: toEvaluationSummary(e.quality_score ?? 0, e.feedback ?? ""),
  }));

  const job = sessionRow.job_id
    ? ((await supabase.from("jobs").select("*").eq("id", sessionRow.job_id).maybeSingle()).data as Job | null)
    : null;

  let nextQuestion;
  try {
    nextQuestion = await generateNextInterviewQuestion(facts, job, history);
  } catch (error) {
    console.error(
      "[interview] Generating next adaptive question failed:",
      error instanceof Error ? error.message : String(error)
    );
    // Don't fail the whole turn — the answer was already evaluated and
    // saved. End the session gracefully rather than leaving the user stuck.
    await supabase
      .from("interview_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("profile_id", userId);
    revalidatePath("/interview");
    return { success: true, finished: true, questionNumber: answered.length, totalQuestions: MAX_ADAPTIVE_QUESTIONS };
  }

  const { data: nextExchange, error: nextExchangeError } = await supabase
    .from("interview_exchanges")
    .insert({
      session_id: sessionId,
      profile_id: userId,
      category: nextQuestion.category,
      question: nextQuestion.question,
      order_index: answered.length,
    })
    .select("id")
    .single();

  if (nextExchangeError || !nextExchange) {
    console.error("[interview] Saving next adaptive question failed:", nextExchangeError?.message);
    return { success: false, error: "Evaluated your answer, but couldn't prepare the next question. Try again." };
  }

  revalidatePath("/interview");
  return {
    success: true,
    finished: false,
    exchangeId: (nextExchange as { id: string }).id,
    category: nextQuestion.category,
    question: nextQuestion.question,
    isFollowUp: nextQuestion.isFollowUp,
    questionNumber: answered.length + 1,
    totalQuestions: MAX_ADAPTIVE_QUESTIONS,
  };
}
