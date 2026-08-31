import "server-only";
import { getAccessToken } from "@/lib/auth/require-user";
import { isWso2Configured } from "@/lib/wso2/client";
import { WSO2Error } from "@/lib/wso2/errors";
import { getResumeViaWso2, type SerializedResume } from "@/lib/wso2/resume";
import { getResumeById } from "./get-resumes";

/**
 * The real, live-traffic WSO2 integration point for a single resume —
 * same pattern as lib/career-profile/get-profile-via-wso2.ts. When WSO2
 * is configured, app/resume/[id]/page.tsx genuinely goes
 * Browser -> Next.js -> WSO2 -> /api/v1/resumes/{id} -> Supabase.
 *
 * Unlike the write-side profile actions (which deliberately do NOT
 * fall back once WSO2 is configured — Part 29's "don't silently bypass
 * governance on a write"), this is a READ, and the existing resilience
 * precedent (getCareerProfileViaWso2OrDirect) already applies the same
 * reasoning to reads: a WSO2 outage degrading a page view to "still
 * works, without the gateway" is the right tradeoff for a GET, where
 * there's no risk of silently dropping a user-intended write.
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
    if (error instanceof WSO2Error) {
      console.error(`[wso2] resume fetch transport=direct (fallback reason: ${error.category} — ${error.message})`);
    } else {
      console.error("[wso2] resume fetch transport=direct (fallback reason:", error instanceof Error ? error.message : String(error), ")");
    }
    return getResumeById(userId, resumeId);
  }
}
