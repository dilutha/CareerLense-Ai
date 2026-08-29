import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { searchJobsCore } from "@/lib/jobs/actions";
import { toJobResultSummary } from "@/lib/jobs/summary";
import { EMPLOYMENT_LEVELS, WORK_MODES } from "@/lib/jobs/schemas";

const MAX_LIMIT = 20;

const searchRequestSchema = z.object({
  role: z.string().trim().max(150).nullable().optional(),
  location: z.string().trim().max(150).nullable().optional(),
  workMode: z.enum(WORK_MODES).nullable().optional(),
  experienceLevel: z.enum(EMPLOYMENT_LEVELS).nullable().optional(),
  employmentType: z.string().optional(),
  international: z.boolean().optional(),
  industry: z.string().trim().max(80).optional(),
  companyType: z.string().trim().max(80).optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
});

/**
 * Reuses the EXISTING discovery + deterministic matching pipeline
 * end-to-end (lib/jobs/actions.ts#searchJobsCore -> discoverJobs ->
 * matchAndCacheJobs -> rankJobs) — Part 6/8's explicit "do not create
 * another job matching engine." `international`/`industry`/`companyType`
 * have no structured field on real job data (no source provides one —
 * see docs/JOB_DATA.md), so — consistent with the same honest choice
 * already made in lib/agent-state/build-search-criteria.ts for the chat
 * agent — they're folded into `keywords` rather than pretending to
 * filter precisely on something the data doesn't have.
 */
export const POST = apiHandler("POST /jobs/search", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body.");
  }

  const parsed = searchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid search request.");
  }
  const input = parsed.data;

  const keywords = new Set(input.keywords ?? []);
  if (input.international) keywords.add("international");
  if (input.industry) keywords.add(input.industry);
  if (input.companyType && input.companyType !== "any") keywords.add(input.companyType);

  const result = await searchJobsCore(auth.userId, {
    role: input.role ?? null,
    location: input.location ?? null,
    workMode: input.workMode ?? null,
    level: input.experienceLevel ?? null,
    keywords: [...keywords].slice(0, 10),
    limit: input.limit ?? MAX_LIMIT,
  });

  if ("error" in result) return apiError("INTERNAL_ERROR", result.error);

  return apiSuccess({
    jobs: result.results.map((r) => toJobResultSummary(r, r.job.source === "demo")),
    providerStatus: result.providerStatus,
  });
});
