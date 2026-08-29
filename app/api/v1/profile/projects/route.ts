import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getCareerProfile } from "@/lib/career-profile/get-profile";

export const GET = apiHandler("GET /profile/projects", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const profile = await getCareerProfile(auth.userId);
  if (!profile) return apiError("NOT_FOUND", "No profile found for this account yet.");

  return apiSuccess({ projects: profile.projects });
});
