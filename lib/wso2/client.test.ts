import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetWso2TokenCacheForTests } from "./auth";
import { callWso2, isWso2Configured } from "./client";
import { WSO2Error } from "./errors";

const BASE_URL = "https://gateway.example/careerlens-rest-api/v1.0";
const TOKEN_URL = "https://gateway.example/oauth2/token";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("isWso2Configured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when the base URL or key is missing", () => {
    vi.stubEnv("WSO2_API_BASE_URL", "");
    vi.stubEnv("WSO2_API_KEY", "");
    expect(isWso2Configured()).toBe(false);
  });

  it("is true when both are set", () => {
    vi.stubEnv("WSO2_API_BASE_URL", BASE_URL);
    vi.stubEnv("WSO2_API_KEY", "test-key");
    expect(isWso2Configured()).toBe(true);
  });
});

describe("callWso2", () => {
  beforeEach(() => {
    vi.stubEnv("WSO2_API_BASE_URL", BASE_URL);
    vi.stubEnv("WSO2_API_KEY", "test-key");
    vi.stubEnv("WSO2_API_KEY_HEADER", "apikey");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("throws CONFIG_ERROR when not configured, without making a network call", async () => {
    vi.stubEnv("WSO2_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(callWso2("/health")).rejects.toMatchObject({ category: "CONFIG_ERROR" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the configured API key header and never a hardcoded one", async () => {
    let capturedHeaders: Headers | Record<string, string> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse({ success: true, status: "healthy" }, 200);
      })
    );

    await callWso2("/health");
    expect((capturedHeaders as Record<string, string>).apikey).toBe("test-key");
  });

  it("forwards the user's bearer token when supplied", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse({ success: true }, 200);
      })
    );

    await callWso2("/profile", { userAccessToken: "user-jwt-123" });
    expect(capturedHeaders?.Authorization).toBe("Bearer user-jwt-123");
  });

  it("returns the parsed success envelope on 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: true, status: "healthy" }, 200)));
    const result = await callWso2<{ success: true; status: string }>("/health");
    expect(result.status).toBe("healthy");
  });

  // Confirmed live against the real gateway this session: WSO2's own
  // rejection has this exact shape.
  it("categorizes WSO2's own gateway rejection as AUTH_ERROR, not our backend's UNAUTHORIZED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ code: "900901", error_message: "Invalid Credentials", error_description: "..." }, 401)
      )
    );

    await expect(callWso2("/health")).rejects.toMatchObject({ category: "AUTH_ERROR" });
  });

  it("categorizes the backend's own 401 (bad user bearer token) as UPSTREAM_UNAUTHORIZED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid token." } }, 401)
      )
    );

    await expect(callWso2("/profile", { userAccessToken: "bad" })).rejects.toMatchObject({
      category: "UPSTREAM_UNAUTHORIZED",
    });
  });

  it("categorizes 429 as RATE_LIMIT_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "900800", error_message: "Rate limit" }, 429)));
    await expect(callWso2("/health")).rejects.toMatchObject({ category: "RATE_LIMIT_ERROR" });
  });

  it("categorizes 5xx as UPSTREAM_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "oops" } }, 502))
    );
    await expect(callWso2("/health")).rejects.toMatchObject({ category: "UPSTREAM_ERROR" });
  });

  it("categorizes a network failure as NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    await expect(callWso2("/health")).rejects.toMatchObject({ category: "NETWORK_ERROR" });
  });

  it("retries once on a 5xx for GET when retryOnFailure is set, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "x" } }, 503))
      .mockResolvedValueOnce(jsonResponse({ success: true, status: "healthy" }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callWso2<{ success: true; status: string }>("/health", { retryOnFailure: true });
    expect(result.status).toBe("healthy");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a non-GET request even with retryOnFailure set", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ success: false, error: { code: "INTERNAL_ERROR", message: "x" } }, 503)
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(callWso2("/profile", { method: "PUT", retryOnFailure: true })).rejects.toBeInstanceOf(WSO2Error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws VALIDATION_ERROR for a 200 with an unexpected shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ unexpected: "shape" }, 200)));
    await expect(callWso2("/health")).rejects.toMatchObject({ category: "VALIDATION_ERROR" });
  });

  it("every rejection carries a correlationId for tracing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ code: "900901", error_message: "no" }, 401)));
    try {
      await callWso2("/health");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WSO2Error);
      expect((error as WSO2Error).correlationId).toBeTruthy();
    }
  });
});

describe("callWso2 — OAuth2 Client Credentials mode", () => {
  beforeEach(() => {
    vi.stubEnv("WSO2_API_BASE_URL", BASE_URL);
    vi.stubEnv("WSO2_TOKEN_URL", TOKEN_URL);
    vi.stubEnv("WSO2_CONSUMER_KEY", "consumer-key");
    vi.stubEnv("WSO2_CONSUMER_SECRET", "consumer-secret");
    // Deliberately do NOT set WSO2_API_KEY — proves OAuth2 mode is
    // self-sufficient and doesn't fall back to the legacy path.
    vi.stubEnv("WSO2_API_KEY", "");
    __resetWso2TokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetWso2TokenCacheForTests();
  });

  it("is configured via OAuth2 vars alone, with no legacy WSO2_API_KEY set", () => {
    expect(isWso2Configured()).toBe(true);
  });

  it("THE critical property: Authorization carries the WSO2 application token, X-Supabase-Token carries the end user's identity — never conflated", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, headers: init?.headers as Record<string, string> });
        if (url === TOKEN_URL) return jsonResponse({ access_token: "wso2-app-token", expires_in: 3600 }, 200);
        return jsonResponse({ success: true, profile: null }, 200);
      })
    );

    await callWso2("/profile", { userAccessToken: "supabase-user-jwt" });

    const apiCall = calls.find((c) => c.url !== TOKEN_URL)!;
    expect(apiCall.headers.Authorization).toBe("Bearer wso2-app-token");
    expect(apiCall.headers["X-Supabase-Token"]).toBe("supabase-user-jwt");
    // The application token must never be replaced by, or mixed with, the user's own token.
    expect(apiCall.headers.Authorization).not.toContain("supabase-user-jwt");
  });

  it("obtains and uses the OAuth2 token even for a call with no user token (e.g. /health)", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, headers: init?.headers as Record<string, string> });
        if (url === TOKEN_URL) return jsonResponse({ access_token: "wso2-app-token", expires_in: 3600 }, 200);
        return jsonResponse({ success: true, status: "healthy" }, 200);
      })
    );

    await callWso2("/health");
    const apiCall = calls.find((c) => c.url !== TOKEN_URL)!;
    expect(apiCall.headers.Authorization).toBe("Bearer wso2-app-token");
    expect(apiCall.headers["X-Supabase-Token"]).toBeUndefined();
  });

  it("propagates a WSO2Error if OAuth2 token acquisition itself fails, before ever calling the API", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return jsonResponse({ error: "invalid_client" }, 401);
      })
    );

    await expect(callWso2("/health")).rejects.toBeInstanceOf(WSO2Error);
    expect(calls).toEqual([TOKEN_URL]); // never reached the actual API
  });

  it("does not send the legacy apikey header when in OAuth2 mode", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === TOKEN_URL) return jsonResponse({ access_token: "t", expires_in: 3600 }, 200);
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse({ success: true, status: "healthy" }, 200);
      })
    );

    await callWso2("/health");
    expect(capturedHeaders?.apikey).toBeUndefined();
  });
});
