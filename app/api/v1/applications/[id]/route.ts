import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getApplicationDetail } from "@/lib/applications/get-applications";
import { updateApplicationStatusCore, deleteApplicationCore } from "@/lib/applications/actions";
import { APPLICATION_STATUSES } from "@/lib/applications/schemas";

/**
 * `id` here is the `applications` table row id (Part 14) — NOT a job id.
 * See /applications/[id]/analyze (and tailor-cv/cover-letter/ats-analysis)
 * for the separate jobId-scoped tailoring flow (Part 11) — the spec names
 * both as "/applications/{...}" with a bare GET at the same shape, an
 * internal conflict this API resolves by keeping the bare
 * GET/PATCH/DELETE scoped to the application row id (the more
 * fundamental "application tracking" resource) and the tailoring
 * sub-actions scoped to jobId — documented in docs/WSO2_API.md.
 */

export const GET = apiHandler("GET /applications/[id]", async (request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const { id } = await ctx.params;
  const detail = await getApplicationDetail(auth.userId, id);
  if (!detail) return apiError("NOT_FOUND", "No application found with that id.");

  return apiSuccess({ application: detail });
});

const patchApplicationSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export const PATCH = apiHandler(
  "PATCH /applications/[id]",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body.");
    }

    const parsed = patchApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "A valid status is required.");
    }

    const { id } = await ctx.params;
    const result = await updateApplicationStatusCore(auth.userId, auth.supabase, id, parsed.data.status, parsed.data.note);
    if (!result.success) return apiError("NOT_FOUND", result.error ?? "Couldn't update that application.");

    return apiSuccess({ updated: true });
  }
);

export const DELETE = apiHandler(
  "DELETE /applications/[id]",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    const { id } = await ctx.params;
    const result = await deleteApplicationCore(auth.userId, auth.supabase, id);
    if (!result.success) return apiError("NOT_FOUND", result.error ?? "Couldn't delete that application.");

    return apiSuccess({ deleted: true });
  }
);
