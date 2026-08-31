import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getResumeById } from "@/lib/resume/get-resumes";

export const GET = apiHandler(
  "GET /resumes/[id]/analysis",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    const { id } = await ctx.params;
    const resume = await getResumeById(auth.userId, id, auth.supabase);
    if (!resume) return apiError("NOT_FOUND", "No resume found with that id.");
    if (!resume.analysis) {
      return apiError("NOT_FOUND", "This resume hasn't been analyzed yet — call POST /resumes/{id}/analyze first.");
    }

    return apiSuccess({ analysis: resume.analysis });
  }
);
