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
});
