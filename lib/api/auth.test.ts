import { describe, expect, it } from "vitest";
import { extractBearerToken } from "./auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/v1/health", { headers });
}

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Authorization header", () => {
    expect(extractBearerToken(makeRequest({ Authorization: "Bearer abc123" }))).toBe("abc123");
  });

  it("is case-insensitive for the 'Bearer' scheme", () => {
    expect(extractBearerToken(makeRequest({ Authorization: "bearer abc123" }))).toBe("abc123");
  });

  it("returns null when there's no Authorization header at all", () => {
    expect(extractBearerToken(makeRequest())).toBeNull();
  });

  it("returns null for a non-Bearer scheme (e.g. Basic auth)", () => {
    expect(extractBearerToken(makeRequest({ Authorization: "Basic dXNlcjpwYXNz" }))).toBeNull();
  });

  it("returns null for 'Bearer' with no token after it", () => {
    expect(extractBearerToken(makeRequest({ Authorization: "Bearer " }))).toBeNull();
    expect(extractBearerToken(makeRequest({ Authorization: "Bearer" }))).toBeNull();
  });

  it("never returns the literal client-supplied token unmodified with surrounding whitespace", () => {
    expect(extractBearerToken(makeRequest({ Authorization: "Bearer   abc123   " }))).toBe("abc123");
  });

  // WSO2 was live-verified not to forward a client-supplied Authorization
  // header through to this backend — see docs/WSO2_INTEGRATION.md §19-20.
  it("falls back to X-Supabase-Token when Authorization is absent (the WSO2 gateway path)", () => {
    expect(extractBearerToken(makeRequest({ "X-Supabase-Token": "xyz789" }))).toBe("xyz789");
  });

  it("prefers a valid Authorization header over X-Supabase-Token when both are present", () => {
    expect(
      extractBearerToken(makeRequest({ Authorization: "Bearer abc123", "X-Supabase-Token": "xyz789" }))
    ).toBe("abc123");
  });

  it("falls back to X-Supabase-Token when Authorization is present but malformed", () => {
    expect(
      extractBearerToken(makeRequest({ Authorization: "Basic dXNlcjpwYXNz", "X-Supabase-Token": "xyz789" }))
    ).toBe("xyz789");
  });

  it("returns null for a blank X-Supabase-Token", () => {
    expect(extractBearerToken(makeRequest({ "X-Supabase-Token": "   " }))).toBeNull();
  });

  it("trims whitespace from X-Supabase-Token", () => {
    expect(extractBearerToken(makeRequest({ "X-Supabase-Token": "  xyz789  " }))).toBe("xyz789");
  });
});
