import "server-only";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";
import { ROADMAP_NARRATION_SYSTEM_PROMPT } from "./prompts";
import type { RoadmapStepPlan } from "./schemas";

/**
 * Narrates an already-built, fully deterministic roadmap plan
 * (lib/learning/build-plan.ts) — Gemini writes only the explanatory
 * summary text, never the steps/order/URLs themselves. Falls back to a
 * plain, honest templated summary if Gemini is unavailable, so a
 * roadmap can always be generated even when this call fails.
 */
export async function narrateRoadmap(steps: RoadmapStepPlan[], targetRole: string): Promise<string> {
  const stepsText = steps
    .map((s, i) => `${i + 1}. ${s.title} (${s.estimatedDurationText})`)
    .join("\n");

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Target role: ${targetRole}\n\nDeterministically-built roadmap steps:\n${stepsText}`,
      config: { systemInstruction: ROADMAP_NARRATION_SYSTEM_PROMPT, temperature: 0.6 },
    });
    const text = response.text?.trim();
    if (text) return text;
  } catch (error) {
    console.error("[learning] Roadmap narration failed:", error instanceof Error ? error.message : String(error));
  }

  return `Here's a ${steps.length}-step plan toward ${targetRole}, ordered by how often each skill actually appears in your matched jobs. Durations are estimates — go at your own pace.`;
}
