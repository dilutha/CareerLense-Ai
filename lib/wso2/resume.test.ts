import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeResumeViaWso2, deleteResumeViaWso2, getResumeAnalysisViaWso2, getResumesViaWso2, getResumeViaWso2 } from "./resume";

const BASE_URL = "https://gateway.example/careerlens-rest-api/v1.0";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("resume WSO2 client functions", () => {
  beforeEach(() => {
    vi.stubEnv("WSO2_API_BASE_URL", BASE_URL);
    vi.stubEnv("WSO2_API_KEY", "test-key");
    vi.stubEnv("WSO2_API_KEY_HEADER", "apikey");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("getResumesViaWso2: GET /resumes, forwards the user token, never the app key as the user identity", async () => {
    let capturedUrl: string | undefined;
    let capturedHeaders: Record<string, string> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse({ success: true, resumes: [{ resume: { id: "r1" }, version: null, analysis: null }] }, 200);
      })
    );

    const resumes = await getResumesViaWso2("user-jwt-1");
    expect(capturedUrl).toBe(`${BASE_URL}/resumes`);
    expect(capturedHeaders?.["X-Supabase-Token"]).toBe("user-jwt-1");
    expect(capturedHeaders?.Authorization).toBe("Bearer user-jwt-1");
    expect(resumes).toHaveLength(1);
  });

  it("getResumeViaWso2: GET /resumes/{id}", async () => {
    let capturedUrl: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return jsonResponse({ success: true, resume: { resume: { id: "r1" }, version: null, analysis: null } }, 200);
      })
    );

    const resume = await getResumeViaWso2("user-jwt", "r1");
    expect(capturedUrl).toBe(`${BASE_URL}/resumes/r1`);
    expect(resume?.resume.id).toBe("r1");
  });

  it("getResumeViaWso2: returns null for a resume the backend reports as not found (never throws for a legitimate absence)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, resume: null }, 200)));
    const resume = await getResumeViaWso2("user-jwt", "missing");
    expect(resume).toBeNull();
  });

  it("deleteResumeViaWso2: DELETE /resumes/{id}", async () => {
    let capturedUrl: string | undefined;
    let capturedMethod: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init?.method;
        return jsonResponse({ success: true }, 200);
      })
    );

    await deleteResumeViaWso2("user-jwt", "r1");
    expect(capturedUrl).toBe(`${BASE_URL}/resumes/r1`);
    expect(capturedMethod).toBe("DELETE");
  });

  it("getResumeAnalysisViaWso2: GET /resumes/{id}/analysis", async () => {
    let capturedUrl: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        capturedUrl = url;
        return jsonResponse({ success: true, analysis: { overall_score: 80 } }, 200);
      })
    );

    const analysis = await getResumeAnalysisViaWso2("user-jwt", "r1");
    expect(capturedUrl).toBe(`${BASE_URL}/resumes/r1/analysis`);
    expect(analysis).toMatchObject({ overall_score: 80 });
  });

  it("analyzeResumeViaWso2: POST /resumes/{id}/analyze, never retried", async () => {
    let capturedMethod: string | undefined;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedMethod = init?.method;
      return jsonResponse({ success: true, resume: { resume: { id: "r1" }, version: null, analysis: { overall_score: 90 } } }, 200);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resume = await analyzeResumeViaWso2("user-jwt", "r1");
    expect(capturedMethod).toBe("POST");
    expect(resume?.analysis?.overall_score).toBe(90);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a WSO2Error on failure instead of swallowing it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "900901", error_message: "Invalid Credentials" }, 401)));
    await expect(getResumesViaWso2("user-jwt")).rejects.toMatchObject({ category: "AUTH_ERROR" });
  });
});
