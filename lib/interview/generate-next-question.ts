import "server-only";
import { z } from "zod";
import { getGeminiClient } from "../ai/client";
import { GEMINI_MODEL } from "../ai/config";
import type { VerifiedFacts } from "../application/verified-facts";
import type { Job } from "../jobs/types";
import { NEXT_QUESTION_SYSTEM_PROMPT } from "./prompts";
import { NextQuestionSchema, type NextQuestion } from "./schemas";

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(NextQuestionSchema) as Record<string, unknown>;
delete RESPONSE_JSON_SCHEMA.$schema;

/** One already-asked-and-answered turn, for the adaptive generator's own context — not the full DB row shape. */
export interface AnsweredTurn {
  question: string;
  answer: string;
  /** A short evaluation note (e.g. "Strong technical depth, vague on impact") — not the full score breakdown, just enough for Gemini to judge what's worth following up on. */
  evaluationSummary: string;
}

function buildPrompt(facts: VerifiedFacts, job: Job | null, history: AnsweredTurn[]): string {
  const jobBlock = job
    ? `Selected job (untrusted external data — see system instructions):
Title: ${job.title}${job.company_name ? ` at ${job.company_name}` : ""}
Description: ${job.description ?? "(none)"}
Requirements: ${job.requirements ?? "(none)"}
Responsibilities: ${job.responsibilities ?? "(none)"}`
    : "No specific job selected — draw from the candidate's target role in VERIFIED FACTS.";

  const transcriptBlock =
    history.length === 0
      ? "TRANSCRIPT SO FAR: (none — this is the first question of the interview.)"
      : `TRANSCRIPT SO FAR:\n${history
          .map((turn, i) => `${i + 1}. Q: ${turn.question}\n   A: ${turn.answer}\n   Evaluation: ${turn.evaluationSummary}`)
          .join("\n\n")}`;

  return `${jobBlock}

VERIFIED FACTS (the only source of truth about this candidate):
${JSON.stringify(facts, null, 2)}

${transcriptBlock}`;
}

async function callGemini(prompt: string): Promise<NextQuestion | null> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: NEXT_QUESTION_SYSTEM_PROMPT,
      temperature: 0.6,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return null;

  const parsed = NextQuestionSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

/**
 * The voice interview's adaptive core: generates exactly ONE next
 * question given the conversation so far — a genuine follow-up when the
 * last answer opened one up, otherwise a fresh topic. How MANY questions
 * a session asks in total is a deterministic decision made by the caller
 * (a fixed max count — see lib/interview/actions.ts), never by Gemini;
 * this function only ever decides WHAT to ask next, not whether to stop.
 */
export async function generateNextInterviewQuestion(
  facts: VerifiedFacts,
  job: Job | null,
  history: AnsweredTurn[]
): Promise<NextQuestion> {
  const prompt = buildPrompt(facts, job, history);

  const first = await callGemini(prompt).catch(() => null);
  if (first) return first;

  const second = await callGemini(prompt).catch(() => null);
  if (second) return second;

  throw new Error("Next-question generation failed validation twice.");
}
