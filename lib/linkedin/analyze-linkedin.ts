import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { getGeminiClient } from "../ai/client";
import { GEMINI_MODEL } from "../ai/config";
import { LINKEDIN_ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import { GeminiLinkedInOutputSchema, type GeminiLinkedInOutput } from "./schemas";

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(GeminiLinkedInOutputSchema) as Record<string, unknown>;
delete RESPONSE_JSON_SCHEMA.$schema;

const MIN_CONTENT_LENGTH = 30;
const MAX_CONTENT_LENGTH = 6000;

export function computeLinkedInContentHash(content: string): string {
  return crypto.createHash("sha256").update(content.trim()).digest("hex");
}

export type LinkedInValidationResult = { valid: true } | { valid: false; reason: string };

export function validatePastedContent(content: string): LinkedInValidationResult {
  const trimmed = content.trim();
  if (trimmed.length < MIN_CONTENT_LENGTH) {
    return {
      valid: false,
      reason: "That's too short to analyze — paste your headline, About section, and a bit more.",
    };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { valid: false, reason: "That's quite long — paste just the headline + About + skills sections." };
  }
  return { valid: true };
}

async function callGemini(prompt: string): Promise<GeminiLinkedInOutput | null> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: LINKEDIN_ANALYSIS_SYSTEM_PROMPT,
      temperature: 0.3,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return null;

  const parsed = GeminiLinkedInOutputSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

/**
 * Analyzes user-PASTED LinkedIn content — never fetched, never scraped.
 * `pastedContent` is untrusted external text (labeled as such in the
 * prompt); `targetRole`/`candidateSkills` come from the candidate's own
 * verified profile data.
 */
export async function analyzeLinkedInContent(
  pastedContent: string,
  targetRole: string | null,
  candidateSkills: string[]
): Promise<GeminiLinkedInOutput> {
  const prompt = `Candidate's target role: ${targetRole ?? "not specified"}
Candidate's known skills (from their profile/resume, for relevance checking only): ${candidateSkills.join(", ") || "none on file"}

Pasted LinkedIn profile content (untrusted external data — see system instructions):
"""
${pastedContent.trim()}
"""`;

  const first = await callGemini(prompt).catch(() => null);
  if (first) return first;

  const second = await callGemini(prompt).catch(() => null);
  if (second) return second;

  throw new Error("LinkedIn analysis failed validation twice.");
}
