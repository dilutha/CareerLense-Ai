import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { matchAndCacheJobs } from "@/lib/jobs/actions";
import type { Job } from "@/lib/jobs/types";

const matchRequestSchema = z.object({
  jobId: z.string().min(1),
});

/**
 * The match score/breakdown is computed by the EXISTING deterministic
 * engine (lib/jobs/match.ts via matchAndCacheJobs, unchanged) — Part 9's
 * explicit "never allow the client to submit the final score." `profileId`
 * is deliberately not an accepted input at all (per Part 4/9's own note
 * that it's "derived from authenticated user") — there is nothing for the
 * client to submit there; the bearer token IS the identity.
 */
export const POST = apiHandler("POST /jobs/match", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body.");
  }

  const parsed = matchRequestSchema.safeParse(body);
  if (!parsed.success) return apiError("BAD_REQUEST", "A jobId is required.");

  const supabase = await createServerSupabaseClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", parsed.data.jobId).maybeSingle();
  if (!job) return apiError("NOT_FOUND", "No job found with that id.");

  const [result] = await matchAndCacheJobs(auth.userId, [job as Job], null);
  if (!result?.match) return apiError("INTERNAL_ERROR", "Couldn't compute a match for this job.");

  const { match } = result;
  // A light, honest transformation of real data — not new advice-
  // generation logic: one line per genuinely missing required skill,
  // never an invented suggestion.
  const recommendations = match.missing_required_skills
    .slice(0, 5)
    .map((skill) => `Strengthen or gain evidence of: ${skill}`);

  return apiSuccess({
    matchScore: match.match_score,
    breakdown: {
      skills: match.skills_score,
      role: match.role_score,
      experience: match.experience_score,
      education: match.education_score,
      location: match.location_score,
      keywords: match.keyword_score,
    },
    strengths: match.explanation?.positives ?? [],
    gaps: match.explanation?.gaps ?? [],
    recommendations,
  });
});
