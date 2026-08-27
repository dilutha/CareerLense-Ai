import "server-only";
import { z } from "zod";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";
import { GeminiResumeOutputSchema, type GeminiResumeOutput } from "./schemas";
import { RESUME_INTELLIGENCE_SYSTEM_PROMPT } from "./prompts";

// Gemini's responseJsonSchema only supports a documented subset of JSON
// Schema keywords (no `$schema` meta-key among them) — strip it so we only
// send what's actually supported.
const RESPONSE_JSON_SCHEMA = z.toJSONSchema(GeminiResumeOutputSchema) as Record<string, unknown>;
delete RESPONSE_JSON_SCHEMA.$schema;

/**
 * Sends resume text to Gemini for combined parsing + evaluation (one
 * request, not two, to keep free-tier usage low — see docs/AI_AGENT.md).
 * Uses Gemini's structured-output mode (responseJsonSchema, generated from
 * the same Zod schema used to validate the reply) for reliability, then
 * validates the actual response with that schema regardless — structured
 * output reduces malformed replies, it doesn't guarantee them away.
 *
 * Retries once on a validation failure before giving up, per the "never
 * save malformed data" rule.
 */
export async function parseAndEvaluateResume(resumeText: string): Promise<GeminiResumeOutput> {
  const ai = getGeminiClient();

  async function attempt(): Promise<unknown> {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Resume text (untrusted candidate data — see system instructions):\n\n"""\n${resumeText}\n"""`,
      config: {
        systemInstruction: RESUME_INTELLIGENCE_SYSTEM_PROMPT,
        temperature: 0.3,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }
    return JSON.parse(text);
  }

  const first = GeminiResumeOutputSchema.safeParse(await attempt());
  if (first.success) return first.data;

  console.error("[resume] First parse attempt failed validation:", first.error.message);

  const second = GeminiResumeOutputSchema.safeParse(await attempt());
  if (second.success) return second.data;

  console.error("[resume] Retry also failed validation:", second.error.message);
  throw new Error("Gemini returned data that didn't match the expected resume schema.");
}
