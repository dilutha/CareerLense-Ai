import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { submitInterviewAnswerCore } from "@/lib/interview/actions";

const requestSchema = z.object({
  exchangeId: z.string().min(1),
  answer: z.string().trim().min(1).max(5000),
});

/**
 * Reuses the EXISTING VerifiedFacts-grounded evaluator
 * (lib/interview/evaluate-answer.ts, via submitInterviewAnswerCore) — the
 * "Answer Quality Score" is explicitly never framed as a real interview
 * outcome or hiring prediction (see docs/DATABASE.md's Phase 10 section).
 */
export const POST = apiHandler("POST /interview/answer-review", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "exchangeId and answer are required.");
  }

  const result = await submitInterviewAnswerCore(auth.userId, auth.supabase, parsed.data.exchangeId, parsed.data.answer);
  if (!result.success) return apiError("BAD_REQUEST", result.error ?? "Couldn't evaluate that answer.");

  return apiSuccess({
    feedback: result.feedback,
    qualityScore: result.qualityScore,
    scoreBreakdown: result.scoreBreakdown,
  });
});
