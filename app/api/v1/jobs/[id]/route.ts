import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getJobWithMatch } from "@/lib/jobs/get-jobs";
import { toJobResultSummary } from "@/lib/jobs/summary";

export const GET = apiHandler("GET /jobs/[id]", async (request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const { id } = await ctx.params;
  const result = await getJobWithMatch(auth.userId, id);
  if (!result) return apiError("NOT_FOUND", "No job found with that id.");

  return apiSuccess({ job: toJobResultSummary(result, result.job.source === "demo") });
});
