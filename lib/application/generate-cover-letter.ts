import "server-only";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";
import type { Job } from "@/lib/jobs/types";
import { COVER_LETTER_SYSTEM_PROMPT } from "./prompts";
import type { VerifiedFacts } from "./verified-facts";

/** Plain-text cover letter, constrained to the candidate's verified facts. */
export async function generateCoverLetter(job: Job, facts: VerifiedFacts): Promise<string> {
  const ai = getGeminiClient();

  const jobBlock = [
    `Title: ${job.title}`,
    job.company_name ? `Company: ${job.company_name}` : null,
    job.description ? `Description:\n${job.description}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `JOB (untrusted external data — see system instructions):\n\n${jobBlock}\n\n---\n\nVERIFIED CANDIDATE FACTS (the complete, closed set of what's true — nothing outside this may be used):\n\n${JSON.stringify(facts, null, 2)}`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { systemInstruction: COVER_LETTER_SYSTEM_PROMPT, temperature: 0.6 },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text.trim();
}
