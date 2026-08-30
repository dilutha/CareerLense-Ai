import { NextResponse } from "next/server";
import { getAccessToken, requireUser } from "@/lib/auth/require-user";
import { isWso2Configured } from "@/lib/wso2/client";
import { WSO2Error } from "@/lib/wso2/errors";
import { getProfileViaWso2, healthCheckViaWso2 } from "@/lib/wso2/profile";

/**
 * A real, live diagnostic — not a mock/demo page — that proves the
 * gateway chain actually works: this route genuinely calls out to WSO2
 * (GET /health, then GET /profile forwarding the caller's own bearer
 * token) exactly the way app/profile/page.tsx does in normal use. Every
 * call here appears in this app's own server logs (search for `[wso2]`)
 * with a correlation ID, and — because it's a real authenticated
 * request through the real gateway — in WSO2's own Developer Portal
 * analytics too. Requires a signed-in CareerLens session (this is a
 * diagnostic for the app's own owner, not a public endpoint).
 */
export async function GET() {
  await requireUser("/api/wso2-status");

  if (!isWso2Configured()) {
    return NextResponse.json({
      configured: false,
      message: "WSO2_API_BASE_URL / WSO2_API_KEY are not set — calls fall back to direct Supabase.",
    });
  }

  const startedAt = Date.now();
  let health: { ok: boolean; status?: string; error?: string; category?: string };
  try {
    const result = await healthCheckViaWso2();
    health = { ok: true, status: result.status };
  } catch (error) {
    health = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      category: error instanceof WSO2Error ? error.category : undefined,
    };
  }
  const healthLatencyMs = Date.now() - startedAt;

  const accessToken = await getAccessToken();
  let profile: { ok: boolean; found?: boolean; error?: string; category?: string };
  const profileStartedAt = Date.now();
  if (!accessToken) {
    profile = { ok: false, error: "No active session to forward." };
  } else {
    try {
      const result = await getProfileViaWso2(accessToken);
      profile = { ok: true, found: result !== null };
    } catch (error) {
      profile = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        category: error instanceof WSO2Error ? error.category : undefined,
      };
    }
  }
  const profileLatencyMs = Date.now() - profileStartedAt;

  return NextResponse.json({
    configured: true,
    reachable: health.ok,
    authenticated: health.ok, // the WSO2 API-key layer only — see profile.ok for whether the end-user's own token round-trips through the gateway too
    gateway: "wso2",
    apiVersion: "v1.0",
    health: { ...health, latencyMs: healthLatencyMs },
    profile: { ...profile, latencyMs: profileLatencyMs },
    note: "See this app's server logs (lines starting `[wso2]`) for the correlation ID of each call above, and WSO2's own Developer Portal analytics for the same requests.",
  });
}
