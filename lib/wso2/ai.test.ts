import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { careerAnalysisViaWso2 } from "./ai";

const BASE_URL = "https://gateway.example/careerlens-rest-api/v1.0";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("careerAnalysisViaWso2", () => {
  beforeEach(() => {
    vi.stubEnv("WSO2_API_BASE_URL", BASE_URL);
    vi.stubEnv("WSO2_API_KEY", "test-key");
    vi.stubEnv("WSO2_API_KEY_HEADER", "apikey");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POSTs /ai/career-analysis with the request body and the user's token, returns the analysis", async () => {
    let capturedUrl: string | undefined;
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init?.body as string);
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse({ success: true, analysis: { strengths: ["Python"], skillGaps: [], recommendations: [] } }, 200);
      })
    );

    const result = await careerAnalysisViaWso2("user-jwt", { careerGoal: "Become a data analyst", skills: ["Python"] });

    expect(capturedUrl).toBe(`${BASE_URL}/ai/career-analysis`);
    expect(capturedBody).toEqual({ careerGoal: "Become a data analyst", skills: ["Python"] });
    expect(capturedHeaders?.["X-Supabase-Token"]).toBe("user-jwt");
    expect(result.strengths).toEqual(["Python"]);
  });

  it("propagates a WSO2Error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "x" } }, 500)));
    await expect(careerAnalysisViaWso2("user-jwt", { careerGoal: "x", skills: [] })).rejects.toMatchObject({ category: "UPSTREAM_ERROR" });
  });
});
