import "server-only";
import { z } from "zod";
import { getGeminiClient } from "../ai/client";
import { GEMINI_MODEL } from "../ai/config";
import { PORTFOLIO_ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import { GeminiPortfolioOutputSchema, type GeminiPortfolioOutput, type PortfolioExtractedContent } from "./schemas";

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(GeminiPortfolioOutputSchema) as Record<string, unknown>;
delete RESPONSE_JSON_SCHEMA.$schema;

function buildPrompt(content: PortfolioExtractedContent, targetRole: string | null, candidateSkills: string[]): string {
  return `Candidate's target role: ${targetRole ?? "not specified"}
Candidate's known skills (from their profile/resume, for relevance checking only): ${candidateSkills.join(", ") || "none on file"}

Extracted page signals:
- Title: ${content.title ?? "(missing)"}
- Meta description: ${content.metaDescription ?? "(missing)"}
- H1 count: ${content.h1Count}
- Heading structure: ${content.headingStructure.join(" > ") || "(none found)"}
- Canonical link present: ${content.canonicalPresent}
- Robots meta present: ${content.robotsMetaPresent}
- Open Graph tags present: ${content.ogPresent}
- Structured data (JSON-LD) present: ${content.structuredDataPresent}
- Images: ${content.imageCount} total, ${content.imagesWithAlt} with alt text
- Internal links: ${content.internalLinkCount}

Visible page text (untrusted external content — see system instructions):
"""
${content.visibleText}
"""`;
}

async function callGemini(prompt: string): Promise<GeminiPortfolioOutput | null> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: PORTFOLIO_ANALYSIS_SYSTEM_PROMPT,
      temperature: 0.3,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) return null;

  const parsed = GeminiPortfolioOutputSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

/**
 * Analyzes already-extracted portfolio content. Retries once on malformed
 * structured output (same pattern as lib/application/tailor-resume.ts) —
 * throws only after both attempts fail, so callers never store an
 * unvalidated result.
 */
export async function analyzePortfolioContent(
  content: PortfolioExtractedContent,
  targetRole: string | null,
  candidateSkills: string[]
): Promise<GeminiPortfolioOutput> {
  const prompt = buildPrompt(content, targetRole, candidateSkills);

  const first = await callGemini(prompt).catch(() => null);
  if (first) return first;

  const second = await callGemini(prompt).catch(() => null);
  if (second) return second;

  throw new Error("Portfolio analysis failed validation twice.");
}
