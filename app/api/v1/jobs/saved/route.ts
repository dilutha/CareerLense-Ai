import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getSavedJobsForUser } from "@/lib/jobs/get-jobs";
import { toJobResultSummary } from "@/lib/jobs/summary";

export const GET = apiHandler("GET /jobs/saved", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const saved = await getSavedJobsForUser(auth.userId);
  return apiSuccess({ jobs: saved.map((r) => toJobResultSummary(r, r.job.source === "demo")) });
});
