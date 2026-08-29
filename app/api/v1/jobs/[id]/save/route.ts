import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";

/**
 * Simple enough (one insert/delete, no Gemini, no matching pipeline) to
 * implement directly against the bearer-token-scoped RLS client rather
 * than needing a *Core extraction from lib/jobs/actions.ts#saveJob/
 * unsaveJob — those exist for the web app's cookie-based session and are
 * otherwise unchanged.
 */
export const POST = apiHandler("POST /jobs/[id]/save", async (request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const { id } = await ctx.params;
  const { error } = await auth.supabase.from("saved_jobs").insert({ profile_id: auth.userId, job_id: id });

  if (error && error.code !== "23505") {
    return apiError("INTERNAL_ERROR", "Couldn't save that job.");
  }
  return apiSuccess({ saved: true });
});

export const DELETE = apiHandler(
  "DELETE /jobs/[id]/save",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    const { id } = await ctx.params;
    const { error } = await auth.supabase
      .from("saved_jobs")
      .delete()
      .eq("profile_id", auth.userId)
      .eq("job_id", id);

    if (error) return apiError("INTERNAL_ERROR", "Couldn't remove that saved job.");
    return apiSuccess({ saved: false });
  }
);
