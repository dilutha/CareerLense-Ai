import { describe, expect, it, vi } from "vitest";
import { apiHandler } from "./handler";
import { apiSuccess } from "./response";

function makeRequest(): Request {
  return new Request("https://example.com/api/v1/health");
}

describe("apiHandler", () => {
  it("passes through a successful handler's response unchanged (aside from the request-id header)", async () => {
    const wrapped = apiHandler("GET /health", async () => apiSuccess({ status: "healthy" }));
    const res = await wrapped(makeRequest(), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual({ success: true, status: "healthy" });
  });

  it("catches an unhandled exception and returns a generic INTERNAL_ERROR — never the raw error message", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = apiHandler("GET /boom", async () => {
      throw new Error("supabase connection string leaked: postgres://user:secretpassword@host");
    });
    const res = await wrapped(makeRequest(), {});
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("secretpassword");
    consoleSpy.mockRestore();
  });

  it("gives every response a request id, even on failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = apiHandler("GET /boom", async () => {
      throw new Error("x");
    });
    const res = await wrapped(makeRequest(), {});
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    consoleSpy.mockRestore();
  });
});
