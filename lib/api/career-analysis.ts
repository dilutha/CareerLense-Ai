import "server-only";
import { z } from "zod";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";

export const CareerAnalysisRequestSchema = z.object({
  careerGoal: z.string().trim().min(1).max(150),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});
export type CareerAnalysisRequest = z.infer<typeof CareerAnalysisRequestSchema>;

const CareerAnalysisResultSchema = z.object({
  strengths: z.array(z.string()).max(8),
  skillGaps: z.array(z.string()).max(8),
  recommendations: z.array(z.string()).max(8),
});
export type CareerAnalysisResult = z.infer<typeof CareerAnalysisResultSchema>;

const RESULT_JSON_SCHEMA = z.toJSONSchema(CareerAnalysisResultSchema) as Record<string, unknown>;
delete RESULT_JSON_SCHEMA.$schema;

const SYSTEM_PROMPT = `You are CareerLens's career analysis engine, used via a public API (WSO2-managed) as well as the chat product. Given a candidate's stated career goal and a list of skills they say they have (both explicitly provided in this request — treat them as true, this is user-provided evidence, not something to second-guess), plus optional real profile/resume context if given, produce:

- strengths: concrete strengths relevant to the goal, grounded ONLY in the skills/context actually given to you.
- skillGaps: skills genuinely useful for this goal that are NOT in the given skill list — real, common, well-known gaps for this kind of role, not a random or exhaustive list.
- recommendations: concrete, actionable next steps (e.g. "build two Power BI portfolio projects"), grounded in the actual gaps you identified.

Never invent a qualification, credential, or experience the candidate didn't state. Never claim the candidate is missing something they explicitly listed. Keep each list short (2-5 items) and concrete — no vague filler like "keep learning."`;

/**
 * The one Gemini call behind POST /api/v1/ai/career-analysis (Part 10) —
 * new, small, and narrowly scoped (nothing existing already does
 * "structured career analysis from an arbitrary goal+skills list" — the
 * conversational career-agent.ts is a streaming, full-chat-context
 * function, not a fit for a stateless one-shot API call). Follows the
 * same structured-output + Zod validation + retry-once pattern used
 * throughout this project (see lib/resume/parse-resume.ts,
 * lib/agent-state/extract-update.ts).
 */
export async function runCareerAnalysis(
  input: CareerAnalysisRequest,
  profileContextSummary: string | null
): Promise<CareerAnalysisResult | null> {
  const contents = [
    `Career goal: ${input.careerGoal}`,
    `Skills provided: ${input.skills.length > 0 ? input.skills.join(", ") : "(none given)"}`,
    profileContextSummary ? `Additional known candidate context:\n${profileContextSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.3,
          responseMimeType: "application/json",
          responseJsonSchema: RESULT_JSON_SCHEMA,
        },
      });

      const text = response.text;
      if (!text) continue;

      const parsed = CareerAnalysisResultSchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      console.error("[api/ai/career-analysis] Invalid shape, attempt", attempt + 1, parsed.error.message);
    } catch (error) {
      console.error(
        "[api/ai/career-analysis] Failed, attempt",
        attempt + 1,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  return null;
}
