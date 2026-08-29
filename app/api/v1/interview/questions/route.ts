import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { startInterviewSessionCore } from "@/lib/interview/actions";
import { getInterviewSession } from "@/lib/interview/get-interview";

const requestSchema = z.object({
  jobId: z.string().min(1).optional(),
  // Accepted per Part 15's example but not yet used to filter question
  // categories — generateInterviewQuestions doesn't currently take a
  // category filter. Documented honestly rather than silently ignored;
  // see docs/WSO2_API.md's known limitations.
  mode: z.string().optional(),
});

/**
 * Reuses the EXISTING VerifiedFacts-grounded question generator
 * (lib/interview/generate-questions.ts, via startInterviewSessionCore) —
 * a "project" question always names a real project, a "job_specific"
 * question is grounded in the real selected job's requirements.
 */
export const POST = apiHandler("POST /interview/questions", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown = {};
  try {
    body = (await request.json().catch(() => ({}))) ?? {};
  } catch {
    // no body is fine — a general (non-job-specific) session is started
  }
  const parsed = requestSchema.safeParse(body);

  const result = await startInterviewSessionCore(auth.userId, auth.supabase, parsed.success ? parsed.data.jobId : undefined);
  if (!result.success || !result.sessionId) {
    return apiError("BAD_REQUEST", result.error ?? "Couldn't prepare interview questions.");
  }

  const session = await getInterviewSession(auth.userId, result.sessionId);
  return apiSuccess({ sessionId: result.sessionId, exchanges: session?.exchanges ?? [] }, 201);
});
