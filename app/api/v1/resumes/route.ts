import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getResumesForUser } from "@/lib/resume/get-resumes";
import { serializeResumeForApi } from "@/lib/api/serialize-resume";

export const GET = apiHandler("GET /resumes", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const resumes = await getResumesForUser(auth.userId);
  return apiSuccess({ resumes: resumes.map(serializeResumeForApi) });
});
