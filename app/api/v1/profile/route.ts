import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getCareerProfile } from "@/lib/career-profile/get-profile";

/**
 * All /api/v1 routes derive the profile owner ENTIRELY from the
 * authenticated bearer token (see lib/api/auth.ts) — never from a
 * client-supplied `profile_id`/`user_id`, which Part 4/16/23 explicitly
 * forbid trusting. There is no "whose profile" parameter on this route
 * at all, by construction: it can only ever be the caller's own.
 *
 * IMPORTANT reuse note: GET below calls the existing
 * `getCareerProfile(userId)` directly — that function already takes an
 * explicit userId and needs no cookie session, so it's genuinely reused
 * as-is. PUT can NOT reuse the existing `updateBasicProfile`/
 * `updateCareerPreferences` Server Actions the way the web app's
 * CareerPreferencesForm does: those derive their user internally via
 * cookie-based `getOptionalUser()`, which is unavailable to a bearer-
 * token API caller with no browser session. PUT instead writes directly
 * through `auth.supabase` (the bearer-token-authenticated, RLS-scoped
 * client from lib/api/auth.ts) — the exact same table, columns, and
 * ownership scoping those actions use, re-validated with an equivalent
 * Zod schema at this API boundary. See docs/WSO2_API.md for the full
 * explanation of why this couldn't just call the existing actions.
 */

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  linkedin_url: z.string().url().max(300).optional(),
  github_url: z.string().url().max(300).optional(),
  portfolio_url: z.string().url().max(300).optional(),
  target_role: z.string().trim().max(150).optional(),
  employment_type: z.enum(["internship", "part_time", "full_time", "contract", "freelance", "any"]).optional(),
  remote_preference: z.enum(["remote", "hybrid", "on_site", "any"]).optional(),
  preferred_locations: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  preferred_industries: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  minimum_salary: z.number().int().min(0).nullable().optional(),
  maximum_salary: z.number().int().min(0).nullable().optional(),
});

const BASIC_FIELDS = ["full_name", "headline", "bio", "location", "phone", "linkedin_url", "github_url", "portfolio_url"] as const;
const PREFERENCE_FIELDS = [
  "target_role",
  "employment_type",
  "remote_preference",
  "preferred_locations",
  "preferred_industries",
  "minimum_salary",
  "maximum_salary",
] as const;

export const GET = apiHandler("GET /profile", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  const profile = await getCareerProfile(auth.userId, auth.supabase);
  if (!profile) return apiError("NOT_FOUND", "No profile found for this account yet.");

  return apiSuccess({ profile });
});

export const PUT = apiHandler("PUT /profile", async (request) => {
  const auth = await authenticateApiRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("BAD_REQUEST", "Invalid JSON body.");
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid request body.");
  }
  const input = parsed.data;

  const basicUpdate = Object.fromEntries(
    BASIC_FIELDS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])
  );
  if (Object.keys(basicUpdate).length > 0) {
    const { error } = await auth.supabase.from("profiles").update(basicUpdate).eq("id", auth.userId);
    if (error) return apiError("INTERNAL_ERROR", "Couldn't update the profile.");
  }

  const preferenceUpdate = Object.fromEntries(
    PREFERENCE_FIELDS.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])
  );
  if (Object.keys(preferenceUpdate).length > 0) {
    const { error } = await auth.supabase
      .from("career_preferences")
      .upsert({ ...preferenceUpdate, profile_id: auth.userId }, { onConflict: "profile_id" });
    if (error) return apiError("INTERNAL_ERROR", "Couldn't update preferences.");
  }

  const updated = await getCareerProfile(auth.userId, auth.supabase);
  return apiSuccess({ profile: updated });
});
