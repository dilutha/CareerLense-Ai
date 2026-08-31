import "server-only";
import { getAccessToken } from "@/lib/auth/require-user";
import { isRealProductionEnvironment, isWso2Configured } from "@/lib/wso2/client";
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
 * (not a decorative unused client — see docs/WSO2_INTEGRATION.md).
 *
 * Environment-aware fallback (deliberate, per this phase's explicit
 * "no silent bypass in production" instruction): in a genuine Vercel
 * Production deployment, once WSO2 is configured a failure THROWS
 * rather than silently degrading — WSO2 is the governed boundary there,
 * and a page that quietly bypassed it would make WSO2 analytics
 * meaningless. In local dev or a Preview deployment, the existing
 * resilient fallback still applies, so WSO2 being unconfigured/down
 * never blocks day-to-day development. `transport` on the return value
 * is the one place callers can tell "WSO2 actually served this" from
 * "we fell back to direct Supabase" — never inferred from the absence
 * of an error.
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
    const category = error instanceof WSO2Error ? error.category : undefined;
    const message = error instanceof Error ? error.message : String(error);

    if (isRealProductionEnvironment()) {
      console.error(`[wso2] profile fetch FAILED in production, not falling back (reason: ${category ?? "unknown"} — ${message})`);
      throw error;
    }

    console.error(`[wso2] profile fetch transport=direct (fallback reason: ${category ?? "unknown"} — ${message})`);
    return { profile: await getCareerProfile(userId), transport: "direct" };
  }
}
