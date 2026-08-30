import "server-only";
import { z } from "zod";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";
import { StateUpdateSchema, type CareerAgentState, type StateUpdate } from "./schema";
import { STATE_UPDATE_SYSTEM_PROMPT } from "./prompts";

// Real bug found live: `\binternship\b` (singular only, with a trailing
// word boundary) never matches "internships" or a bare "Intern" — the `\b`
// after "internship" fails whenever the word continues (e.g. the "s" in
// "internships"). That's the confirmed cause of the chat responding
// conversationally instead of searching for the exact phrases "Software
// Engineer Intern", "Find Python internships", etc. — 5 of the 9 phrases
// in the acceptance test failed this gate before the fix below. Same
// unbounded-stem issue existed for "vacan"/"opportunit" (bare stems with
// a trailing \b can't match their own inflected forms either) — fixed the
// same way, with \w* instead of assuming a specific suffix.
const JOB_TALK_KEYWORDS =
  /\b(job|jobs|intern(?:ship)?s?|vacan\w*|hire|hiring|position|role|opportunit\w*|hoyanna|hoyala|company|companies|salary|salaries|remote|hybrid|onsite|international|CV|resume|apply|interview)\b/i;

/**
 * Cheap gate deciding whether this message is worth an extraction call at
 * all. Broader than lib/jobs/intent.ts's looksLikeJobSearchMessage on
 * purpose: once a conversation already has intent="job_search", a
 * refinement message ("international company ekak nam hodai") often has
 * NO job-search keyword in it at all — the only reliable signal left is
 * that the conversation is already mid-search (Part 9's core problem).
 */
export function shouldExtractStateUpdate(userText: string, currentState: CareerAgentState): boolean {
  return currentState.intent === "job_search" || JOB_TALK_KEYWORDS.test(userText);
}

const UPDATE_JSON_SCHEMA = z.toJSONSchema(StateUpdateSchema) as Record<string, unknown>;
delete UPDATE_JSON_SCHEMA.$schema;

function buildPrompt(userMessage: string, currentState: CareerAgentState, profileContextSummary: string | null): string {
  const parts = [`CURRENT STATE:\n${JSON.stringify(currentState)}`];
  if (profileContextSummary) parts.push(`Known candidate context:\n${profileContextSummary}`);
  parts.push(`User message: "${userMessage}"`);
  return parts.join("\n\n");
}

async function callGemini(prompt: string): Promise<unknown> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: STATE_UPDATE_SYSTEM_PROMPT,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: UPDATE_JSON_SCHEMA,
    },
  });
  const text = response.text;
  if (!text) throw new Error("Empty response");
  return JSON.parse(text);
}

/**
 * Extracts one turn's state update. Only called when
 * shouldExtractStateUpdate() already passed. Retries once on a malformed
 * (schema-invalid) response before giving up — matches this project's
 * established pattern (lib/resume/parse-resume.ts). Never throws to the
 * caller; a failed extraction just means no state update this turn, the
 * conversational reply still proceeds normally.
 */
export async function extractStateUpdate(
  userMessage: string,
  currentState: CareerAgentState,
  profileContextSummary: string | null
): Promise<StateUpdate | null> {
  const prompt = buildPrompt(userMessage, currentState, profileContextSummary);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callGemini(prompt);
      const parsed = StateUpdateSchema.safeParse(raw);
      if (parsed.success) return parsed.data;
      console.error("[agent-state] Extraction returned invalid shape, attempt", attempt + 1, parsed.error.message);
    } catch (error) {
      console.error(
        "[agent-state] Extraction failed, attempt",
        attempt + 1,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  return null;
}
