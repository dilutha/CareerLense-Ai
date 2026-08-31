import "server-only";
import { getAccessToken } from "@/lib/auth/require-user";
import { isRealProductionEnvironment, isWso2Configured } from "@/lib/wso2/client";
import { WSO2Error } from "@/lib/wso2/errors";
import { getResumeViaWso2, type SerializedResume } from "@/lib/wso2/resume";
import { getResumeById } from "./get-resumes";

/**
 * The real, live-traffic WSO2 integration point for a single resume —
 * same pattern as lib/career-profile/get-profile-via-wso2.ts. When WSO2
 * is configured, app/resume/[id]/page.tsx genuinely goes
 * Browser -> Next.js -> WSO2 -> /api/v1/resumes/{id} -> Supabase.
 *
 * Environment-aware fallback, made consistent with the profile wrapper
 * (this phase's "no silent bypass in production" instruction applies
 * broadly, not only to writes): in a genuine Vercel Production
 * deployment, a WSO2 failure throws instead of silently degrading. In
 * local dev or a Preview deployment, the existing resilient fallback
 * still applies.
 */
export async function getResumeViaWso2OrDirect(
  userId: string,
  resumeId: string
): Promise<SerializedResume | null> {
  if (!isWso2Configured()) {
    return getResumeById(userId, resumeId);
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return getResumeById(userId, resumeId);
  }

  try {
    return await getResumeViaWso2(accessToken, resumeId);
  } catch (error) {
    const category = error instanceof WSO2Error ? error.category : undefined;
    const message = error instanceof Error ? error.message : String(error);

    if (isRealProductionEnvironment()) {
      console.error(`[wso2] resume fetch FAILED in production, not falling back (reason: ${category ?? "unknown"} — ${message})`);
      throw error;
    }

    console.error(`[wso2] resume fetch transport=direct (fallback reason: ${category ?? "unknown"} — ${message})`);
    return getResumeById(userId, resumeId);
  }
}
