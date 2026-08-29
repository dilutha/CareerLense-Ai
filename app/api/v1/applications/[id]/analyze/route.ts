import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getOrCreateApplicationCore, runApplicationAnalysisCore } from "@/lib/application/actions";
import { getApplicationBundle } from "@/lib/application/get-application";
import { getDefaultResume } from "@/lib/resume/get-resumes";

/**
 * `id` here is a JOB id (Part 11's `{jobId}`) — see
 * /applications/[id]/route.ts's header comment for why this differs from
 * the bare GET/PATCH/DELETE's `id` (an applications row id).
 */
const analyzeRequestSchema = z.object({ resumeId: z.string().min(1).optional() });

export const POST = apiHandler(
  "POST /applications/[id]/analyze",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    let body: unknown = {};
    try {
      body = (await request.json().catch(() => ({}))) ?? {};
    } catch {
      // no body is fine — resumeId falls back to the default resume below
    }
    const parsed = analyzeRequestSchema.safeParse(body);
    const resumeId = parsed.success ? parsed.data.resumeId : undefined;

    const { id: jobId } = await ctx.params;

    const effectiveResumeId = resumeId ?? (await getDefaultResume(auth.userId))?.resume.id;
    if (!effectiveResumeId) {
      return apiError("BAD_REQUEST", "No resumeId given and no default resume on file — upload a CV first.");
    }

    const created = await getOrCreateApplicationCore(auth.userId, auth.supabase, jobId, effectiveResumeId);
    if (!created.success || !created.documentId) {
      return apiError("BAD_REQUEST", created.error ?? "Couldn't start this application.");
    }

    const result = await runApplicationAnalysisCore(auth.userId, auth.supabase, created.documentId);
    if (!result.success) return apiError("BAD_REQUEST", result.error ?? "Couldn't analyze this application.");

    const bundle = await getApplicationBundle(auth.userId, jobId);
    return apiSuccess({ analysis: bundle.analysis });
  }
);
