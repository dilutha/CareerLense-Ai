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
import { computeAnswerQualityScore } from "./score";

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
