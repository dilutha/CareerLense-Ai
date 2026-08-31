import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { processResumeCore } from "@/lib/resume/actions";
import { getResumeById } from "@/lib/resume/get-resumes";
import { serializeResumeForApi } from "@/lib/api/serialize-resume";

/**
 * Runs the SAME Gemini extraction/scoring pipeline the web app's
 * "Process" step uses (lib/resume/actions.ts#processResumeCore) — a
 * Gemini-powered endpoint, kept in mind for stricter WSO2 rate limiting
 * (Part 20).
 */
export const POST = apiHandler(
  "POST /resumes/[id]/analyze",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    const { id } = await ctx.params;
    const result = await processResumeCore(auth.userId, auth.supabase, id);
    if (!result.success) return apiError("BAD_REQUEST", result.error ?? "Couldn't analyze this resume.");

    const resume = await getResumeById(auth.userId, id, auth.supabase);
    return apiSuccess({ resume: resume ? serializeResumeForApi(resume) : null });
  }
);
