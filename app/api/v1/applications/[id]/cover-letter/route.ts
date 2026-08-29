import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getOrCreateApplicationCore, generateCoverLetterForApplicationCore } from "@/lib/application/actions";
import { getApplicationBundle } from "@/lib/application/get-application";
import { getDefaultResume } from "@/lib/resume/get-resumes";

/** `id` is a JOB id — see /applications/[id]/analyze/route.ts's header comment. */
const requestSchema = z.object({ resumeId: z.string().min(1).optional() });

/**
 * Same VerifiedFacts guarantee as tailor-cv (Part 13): never invents
 * employment, degrees, certifications, projects, or companies.
 */
export const POST = apiHandler(
  "POST /applications/[id]/cover-letter",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    let body: unknown = {};
    try {
      body = (await request.json().catch(() => ({}))) ?? {};
    } catch {
      // no body is fine
    }
    const parsed = requestSchema.safeParse(body);
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

    const result = await generateCoverLetterForApplicationCore(auth.userId, auth.supabase, created.documentId);
    if (!result.success) return apiError("BAD_REQUEST", result.error ?? "Couldn't write a cover letter for this job.");

    const bundle = await getApplicationBundle(auth.userId, jobId);
    return apiSuccess({ coverLetter: bundle.latestCoverLetter });
  }
);
