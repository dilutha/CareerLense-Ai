import "server-only";
import { z } from "zod";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";
import { JobSearchIntentSchema, type JobSearchIntent } from "./schemas";

const JOB_SEARCH_KEYWORDS =
  /\b(job|jobs|internship|vacan|hire|hiring|position|role|opportunit|hoyanna|hoyala|vacancy)\b/i;

/**
 * Cheap keyword gate — avoids an extra Gemini call on every single chat
 * message. Only messages that plausibly relate to job-hunting go on to
 * intent extraction.
 */
export function looksLikeJobSearchMessage(text: string): boolean {
  return JOB_SEARCH_KEYWORDS.test(text);
}

const INTENT_JSON_SCHEMA = z.toJSONSchema(JobSearchIntentSchema) as Record<string, unknown>;
delete INTENT_JSON_SCHEMA.$schema;

const INTENT_SYSTEM_PROMPT = `You extract job-search intent from one user message in a career-assistant chat, as JSON matching the provided schema.

Set shouldSearch to true only if the user is actually asking to find/search for jobs or internships right now (e.g. "find me a data analyst internship", "any software jobs in Colombo?", "show me remote roles"). Set it to false for anything else — general career questions, chat about their CV, small talk, or a message too vague to search on (e.g. just "jobs?" with no role/context) — and in that false case, optionally suggest a short clarifyingQuestion the assistant could ask instead (e.g. "What kind of role are you looking for?").

Use the candidate's known context (profile below, if given) to fill in role/location when the message itself doesn't restate them but is clearly a continuation of a job search (e.g. user previously said Data Analyst, now just says "in Kandy too"). Never invent a role or location the user hasn't stated or that isn't in their profile — leave the field null instead.

Default country is Sri Lanka unless the user clearly asks for elsewhere.`;

/**
 * Extracts structured search intent from the user's latest message,
 * using their known profile context to fill gaps (e.g. target role)
 * without inventing anything they haven't actually stated. Only called
 * when looksLikeJobSearchMessage() already passed.
 */
export async function extractJobSearchIntent(
  userMessage: string,
  profileContextSummary: string | null
): Promise<JobSearchIntent | null> {
  try {
    const ai = getGeminiClient();
    const contents = profileContextSummary
      ? `Known candidate context:\n${profileContextSummary}\n\nUser message: "${userMessage}"`
      : `User message: "${userMessage}"`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: INTENT_SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: INTENT_JSON_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JobSearchIntentSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error(
      "[jobs] Intent extraction failed:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
