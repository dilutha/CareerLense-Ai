import { describe, expect, it } from "vitest";
import { apiError, apiSuccess } from "./response";

describe("apiSuccess", () => {
  it("wraps the body with success: true and defaults to 200", async () => {
    const res = apiSuccess({ jobs: [1, 2] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, jobs: [1, 2] });
  });

  it("accepts a custom status code", () => {
    const res = apiSuccess({ id: "x" }, 201);
    expect(res.status).toBe(201);
  });
});

describe("apiError", () => {
  it("maps each error code to the correct HTTP status", () => {
    expect(apiError("BAD_REQUEST", "x").status).toBe(400);
    expect(apiError("UNAUTHORIZED", "x").status).toBe(401);
    expect(apiError("FORBIDDEN", "x").status).toBe(403);
    expect(apiError("NOT_FOUND", "x").status).toBe(404);
    expect(apiError("CONFLICT", "x").status).toBe(409);
    expect(apiError("RATE_LIMITED", "x").status).toBe(429);
    expect(apiError("INTERNAL_ERROR", "x").status).toBe(500);
  });

  it("produces the exact { success: false, error: { code, message } } shape", async () => {
    const res = apiError("NOT_FOUND", "Job not found.");
    const body = await res.json();
    expect(body).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Job not found." } });
  });
});
