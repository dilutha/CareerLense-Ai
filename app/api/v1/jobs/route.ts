import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toJobResultSummary } from "@/lib/jobs/summary";
import type { Job } from "@/lib/jobs/types";

const MAX_LIMIT = 50;

/**
 * A plain, unmatched browse of recently-seen active jobs (real rows, no
 * demo data mixed in silently — `is_active` is only ever set by real
 * ingestion). This is genuinely a new, simple read (nothing existing
 * already does "list all jobs" — the app itself only ever searches) —
 * kept intentionally minimal: no matching computed here, since that's a
 * per-candidate operation (see POST /jobs/search and POST /jobs/match).
 */
export const GET = apiHandler("GET /jobs", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const url = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return apiError("INTERNAL_ERROR", "Couldn't load jobs right now.");

  const jobs = ((data ?? []) as Job[]).map((job) =>
    toJobResultSummary({ job, skills: [], match: null }, job.source === "demo")
  );

  return apiSuccess({ jobs, limit, offset });
});
