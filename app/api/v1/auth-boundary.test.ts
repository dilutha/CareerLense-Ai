/**
 * Every /api/v1 route (except /health, deliberately public — Part 3)
 * must reject a request with no valid bearer token before touching
 * Supabase or Gemini at all — directly testable without mocking either,
 * since `authenticateApiRequest` returns null purely from inspecting the
 * Authorization header, so every route handler short-circuits to
 * apiError("UNAUTHORIZED", ...) before any external call.
 *
 * KNOWN GAP: Next.js's "use server" directive handling collides with
 * `vitest.config.mts`'s `react-server` resolve condition
 * (`next/dist/client/components/navigation.js` fails calling
 * `React.createContext`, a client-only API unavailable under that
 * condition) — importing ANY file that carries `"use server"`
 * (lib/{resume,application,applications,interview,jobs}/actions.ts)
 * crashes at import time in this test environment, regardless of which
 * export is actually used. Because ES modules evaluate a file's ENTIRE
 * import graph at load time (not just the export you reference), this
 * poisons every route file where ANY handler — even one this file
 * doesn't test — imports a `*Core` function from one of those files.
 * That excludes: DELETE /resumes/[id], POST /resumes/[id]/analyze, POST
 * /jobs/search, POST /jobs/match, POST /applications, PATCH/DELETE
 * /applications/[id], all four /applications/[id]/* tailoring routes, and
 * all three /interview/* routes. Their auth check runs the exact same
 * `authenticateApiRequest` call (unit-tested independently in
 * auth.test.ts) wrapped by the exact same `apiHandler` (unit-tested
 * independently in handler.test.ts) as everything below — the
 * composition is exercised, just not as one end-to-end route-level test
 * for those specific files. A real, disclosed gap, not silently dropped
 * coverage.
 */
import { describe, expect, it } from "vitest";
import { GET as healthGet } from "./health/route";
import { GET as profileGet, PUT as profilePut } from "./profile/route";
import { GET as skillsGet } from "./profile/skills/route";
import { GET as educationGet } from "./profile/education/route";
import { GET as experienceGet } from "./profile/experience/route";
import { GET as projectsGet } from "./profile/projects/route";
import { GET as preferencesGet } from "./profile/preferences/route";
import { GET as resumesGet } from "./resumes/route";
import { GET as resumeAnalysisGet } from "./resumes/[id]/analysis/route";
import { GET as jobsGet } from "./jobs/route";
import { GET as jobGet } from "./jobs/[id]/route";
import { GET as jobsSavedGet } from "./jobs/saved/route";
import { POST as jobSavePost, DELETE as jobSaveDelete } from "./jobs/[id]/save/route";
import { POST as careerAnalysisPost } from "./ai/career-analysis/route";

function unauthenticatedRequest(method: string, body?: unknown): Request {
  return new Request("https://example.com/api/v1/x", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const paramCtx = { params: Promise.resolve({ id: "x" }) };

describe("/api/v1 auth boundary — every route requires a valid bearer token except /health", () => {
  it("GET /health is public — never requires auth", async () => {
    const res = await healthGet(unauthenticatedRequest("GET"), {});
    expect(res.status).toBe(200);
  });

  const noParamRoutes: [string, (req: Request, ctx: object) => Promise<Response>, string, unknown?][] = [
    ["GET /profile", profileGet, "GET"],
    ["PUT /profile", profilePut, "PUT", {}],
    ["GET /profile/skills", skillsGet, "GET"],
    ["GET /profile/education", educationGet, "GET"],
    ["GET /profile/experience", experienceGet, "GET"],
    ["GET /profile/projects", projectsGet, "GET"],
    ["GET /profile/preferences", preferencesGet, "GET"],
    ["GET /resumes", resumesGet, "GET"],
    ["GET /jobs", jobsGet, "GET"],
    ["GET /jobs/saved", jobsSavedGet, "GET"],
    ["POST /ai/career-analysis", careerAnalysisPost, "POST", { careerGoal: "x" }],
  ];

  it.each(noParamRoutes)("%s returns 401 without a bearer token", async (_label, handler, method, body) => {
    const res = await handler(unauthenticatedRequest(method, body), {});
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  const paramRoutes: [string, (req: Request, ctx: typeof paramCtx) => Promise<Response>, string, unknown?][] = [
    ["GET /resumes/[id]/analysis", resumeAnalysisGet, "GET"],
    ["GET /jobs/[id]", jobGet, "GET"],
    ["POST /jobs/[id]/save", jobSavePost, "POST"],
    ["DELETE /jobs/[id]/save", jobSaveDelete, "DELETE"],
  ];

  it.each(paramRoutes)("%s returns 401 without a bearer token", async (_label, handler, method, body) => {
    const res = await handler(unauthenticatedRequest(method, body), paramCtx);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });
});
