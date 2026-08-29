import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getApplicationsForUser } from "@/lib/applications/get-applications";
import { trackApplicationCore } from "@/lib/applications/actions";
import { APPLICATION_STATUSES } from "@/lib/applications/schemas";

export const GET = apiHandler("GET /applications", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const applications = await getApplicationsForUser(auth.userId);
  return apiSuccess({ applications });
});

const createApplicationSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(APPLICATION_STATUSES).optional(),
});

export const POST = apiHandler("POST /applications", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body.");
  }

  const parsed = createApplicationSchema.safeParse(body);
  if (!parsed.success) return apiError("BAD_REQUEST", "A jobId is required.");

  const result = await trackApplicationCore(auth.userId, auth.supabase, parsed.data.jobId, parsed.data.status);
  if (!result.success) return apiError("BAD_REQUEST", result.error ?? "Couldn't track this application.");

  return apiSuccess({ applicationId: result.applicationId }, 201);
});
