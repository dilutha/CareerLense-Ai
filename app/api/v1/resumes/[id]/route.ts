import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getResumeById } from "@/lib/resume/get-resumes";
import { deleteResumeCore } from "@/lib/resume/actions";
import { serializeResumeForApi } from "@/lib/api/serialize-resume";

export const GET = apiHandler("GET /resumes/[id]", async (request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const { id } = await ctx.params;
  const resume = await getResumeById(auth.userId, id, auth.supabase);
  if (!resume) return apiError("NOT_FOUND", "No resume found with that id.");

  return apiSuccess({ resume: serializeResumeForApi(resume) });
});

export const DELETE = apiHandler("DELETE /resumes/[id]", async (request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const { id } = await ctx.params;
  const result = await deleteResumeCore(auth.userId, auth.supabase, id);
  if (!result.success) return apiError("NOT_FOUND", result.error ?? "Couldn't delete that resume.");

  return apiSuccess({ deleted: true });
});
