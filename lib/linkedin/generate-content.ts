import "server-only";
import { getGeminiClient } from "../ai/client";
import { GEMINI_MODEL } from "../ai/config";
import type { VerifiedFacts } from "../application/verified-facts";
import { LINKEDIN_CONTENT_SYSTEM_PROMPT } from "./prompts";
import type { LinkedInContentSection } from "./schemas";

const SECTION_INSTRUCTIONS: Record<LinkedInContentSection, string> = {
  headline_a: "Write headline option A — lead with role/status.",
  headline_b: "Write headline option B — lead with core skills.",
  headline_c: "Write headline option C — lead with a project/aspiration highlight.",
  about: "Write the About section.",
  skills: "Write the skills list to feature.",
};

export async function generateLinkedInSection(
  section: LinkedInContentSection,
  facts: VerifiedFacts
): Promise<string> {
  const ai = getGeminiClient();

  const prompt = `${SECTION_INSTRUCTIONS[section]}

VERIFIED FACTS (the only source of truth for this candidate):
${JSON.stringify(facts, null, 2)}`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: LINKEDIN_CONTENT_SYSTEM_PROMPT,
      temperature: 0.7,
    },
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Content generation returned no text.");
  return text;
}
