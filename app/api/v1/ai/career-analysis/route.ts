import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { buildCareerContext } from "@/lib/career-profile/profile-context";
import { CareerAnalysisRequestSchema, runCareerAnalysis } from "@/lib/api/career-analysis";

/**
 * The main WSO2 + Gemini demonstration endpoint (Part 10) — a Gemini-
 * powered API, kept in mind for the strictest WSO2 rate limiting
 * (Part 20: 10/min suggested).
 */
export const POST = apiHandler("POST /ai/career-analysis", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body.");
  }

  const parsed = CareerAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "A careerGoal is required.");
  }

  // Real profile/resume context, if any, is passed as ADDITIONAL grounding
  // — never a substitute for what was actually given in the request.
  const profile = await getCareerProfile(auth.userId);
  const profileContext = profile ? buildCareerContext(profile) : null;

  const analysis = await runCareerAnalysis(parsed.data, profileContext);
  if (!analysis) return apiError("INTERNAL_ERROR", "Couldn't complete the analysis right now. Try again.");

  return apiSuccess({ analysis });
});
