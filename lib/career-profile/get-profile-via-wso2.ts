import "server-only";
import { getAccessToken } from "@/lib/auth/require-user";
import { isWso2Configured } from "@/lib/wso2/client";
import { WSO2Error } from "@/lib/wso2/errors";
import { getProfileViaWso2 } from "@/lib/wso2/profile";
import { getCareerProfile } from "./get-profile";
import type { CareerProfile } from "./types";

/**
 * The real, live-traffic WSO2 integration point: when WSO2 is configured,
 * a normal /profile page load genuinely goes
 * Browser -> Next.js server -> WSO2 gateway -> /api/v1/profile -> Supabase
 * (not a decorative unused client — see docs/WSO2_INTEGRATION.md). Falls
 * back to the existing direct call on ANY WSO2 failure (misconfiguration,
 * gateway down, timeout, rate limit) so a WSO2 outage never breaks the
 * page users already rely on — logged server-side either way.
 */
export async function getCareerProfileViaWso2OrDirect(userId: string): Promise<CareerProfile | null> {
  if (!isWso2Configured()) {
    return getCareerProfile(userId);
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return getCareerProfile(userId);
  }

  try {
    return await getProfileViaWso2(accessToken);
  } catch (error) {
    if (error instanceof WSO2Error) {
      console.error(`[wso2] profile fetch fell back to direct Supabase: ${error.category} — ${error.message}`);
    } else {
      console.error("[wso2] profile fetch fell back to direct Supabase:", error instanceof Error ? error.message : String(error));
    }
    return getCareerProfile(userId);
  }
}
