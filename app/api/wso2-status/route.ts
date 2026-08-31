import { NextResponse } from "next/server";
import { getAccessToken, requireUser } from "@/lib/auth/require-user";
import { isWso2OAuth2Configured } from "@/lib/wso2/auth";
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
      status: "NOT_CONFIGURED",
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

  // Distinct failure modes, not collapsed into one boolean: a
  // NETWORK_ERROR/TIMEOUT_ERROR means the gateway itself couldn't be
  // reached at all; any other failure (e.g. AUTH_ERROR/900901) means the
  // gateway WAS reached but rejected the configured credential. This is
  // exactly the distinction that separated two real, unrelated incidents
  // this project hit in production (a header-forwarding bug vs. an
  // expired test key) — collapsing them back into one signal would hide
  // that difference again.
  const unreachableCategories = new Set(["NETWORK_ERROR", "TIMEOUT_ERROR"]);
  const reachable = health.ok || !unreachableCategories.has(health.category ?? "");
  const authenticated = health.ok;

  // A single named state alongside the booleans above — same underlying
  // signal, just spelled out for a caller that wants one field to branch
  // on instead of re-deriving the same logic. AUTHENTICATED only means
  // the WSO2 API-key layer is valid (the health check needs no user
  // token); it does NOT by itself mean a specific user's /profile call
  // succeeded through the gateway — that's profile.ok, checked separately
  // (UPSTREAM_ERROR covers "gateway + WSO2 key are fine, but the
  // downstream /profile call still failed").
  const status: "NOT_CONFIGURED" | "GATEWAY_UNREACHABLE" | "GATEWAY_AUTH_FAILED" | "AUTHENTICATED" | "UPSTREAM_ERROR" =
    !reachable ? "GATEWAY_UNREACHABLE" : !authenticated ? "GATEWAY_AUTH_FAILED" : profile.ok ? "AUTHENTICATED" : "UPSTREAM_ERROR";

  return NextResponse.json({
    configured: true,
    status,
    reachable,
    authenticated, // the WSO2 API-key layer only — see profile.ok for whether the end-user's own token round-trips through the gateway too
    gateway: reachable ? "wso2" : "unreachable",
    credentialMode: isWso2OAuth2Configured() ? "oauth2_client_credentials" : "legacy_test_key",
    apiVersion: "v1.0",
    health: { ...health, latencyMs: healthLatencyMs },
    profile: { ...profile, latencyMs: profileLatencyMs },
    note: "See this app's server logs (lines starting `[wso2]`) for the correlation ID of each call above, and WSO2's own Developer Portal analytics for the same requests.",
  });
}
