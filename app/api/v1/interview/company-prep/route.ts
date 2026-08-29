import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { startInterviewSessionCore } from "@/lib/interview/actions";
import { getInterviewSession } from "@/lib/interview/get-interview";

const requestSchema = z.object({ jobId: z.string().min(1) });

/**
 * Deliberately the SAME underlying mechanism as POST /interview/questions
 * (Part 1: "do not duplicate business logic") — company/job-specific prep
 * is exactly what startInterviewSessionCore already produces when given a
 * jobId (its "job_specific" question category is grounded in that job's
 * real requirements, via VerifiedFacts). This endpoint exists as a
 * separately-named resource per Part 15/19's API catalogue, requiring
 * jobId (unlike /interview/questions, where it's optional), not as a
 * second question-generation pipeline. No separate "company research"
 * capability exists — see docs/WSO2_API.md's known limitations.
 */
export const POST = apiHandler("POST /interview/company-prep", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return apiError("BAD_REQUEST", "A jobId is required for company-specific prep.");

  const result = await startInterviewSessionCore(auth.userId, auth.supabase, parsed.data.jobId);
  if (!result.success || !result.sessionId) {
    return apiError("BAD_REQUEST", result.error ?? "Couldn't prepare company-specific interview questions.");
  }

  const session = await getInterviewSession(auth.userId, result.sessionId);
  return apiSuccess({ sessionId: result.sessionId, exchanges: session?.exchanges ?? [] }, 201);
});
