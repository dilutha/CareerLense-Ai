import "server-only";
import { getAccessToken } from "@/lib/auth/require-user";
import { isWso2Configured } from "@/lib/wso2/client";
import { WSO2Error } from "@/lib/wso2/errors";
import { getProfileViaWso2 } from "@/lib/wso2/profile";
import { getCareerProfile } from "./get-profile";
import type { CareerProfile } from "./types";

/** Which transport actually served the request — never inferred, always the true path taken (never claim "wso2" for a request that silently fell back). */
export type ProfileTransport = "wso2" | "direct" | "not_configured";

export interface ProfileFetchResult {
  profile: CareerProfile | null;
  transport: ProfileTransport;
}

/**
 * The real, live-traffic WSO2 integration point: when WSO2 is configured,
 * a normal /profile page load genuinely goes
 * Browser -> Next.js server -> WSO2 gateway -> /api/v1/profile -> Supabase
 * (not a decorative unused client — see docs/WSO2_INTEGRATION.md). Falls
 * back to the existing direct call on ANY WSO2 failure (misconfiguration,
 * gateway down, timeout, rate limit) so a WSO2 outage never breaks the
 * page users already rely on. `transport` on the return value is the one
 * place callers can tell "WSO2 actually served this" from "we fell back to
 * direct Supabase" — never inferred from the absence of an error.
 */
export async function getCareerProfileViaWso2OrDirect(userId: string): Promise<ProfileFetchResult> {
  if (!isWso2Configured()) {
    return { profile: await getCareerProfile(userId), transport: "not_configured" };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { profile: await getCareerProfile(userId), transport: "direct" };
  }

  try {
    const profile = await getProfileViaWso2(accessToken);
    console.log("[wso2] profile fetch transport=wso2");
    return { profile, transport: "wso2" };
  } catch (error) {
    if (error instanceof WSO2Error) {
      console.error(`[wso2] profile fetch transport=direct (fallback reason: ${error.category} — ${error.message})`);
    } else {
      console.error("[wso2] profile fetch transport=direct (fallback reason:", error instanceof Error ? error.message : String(error), ")");
    }
    return { profile: await getCareerProfile(userId), transport: "direct" };
  }
}
