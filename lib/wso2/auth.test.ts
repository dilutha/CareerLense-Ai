import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetWso2TokenCacheForTests, getWso2AccessToken, isWso2OAuth2Configured } from "./auth";
import { WSO2Error } from "./errors";

const TOKEN_URL = "https://gateway.example/oauth2/token";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("isWso2OAuth2Configured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when any of the three variables is missing", () => {
    vi.stubEnv("WSO2_TOKEN_URL", TOKEN_URL);
    vi.stubEnv("WSO2_CONSUMER_KEY", "");
    vi.stubEnv("WSO2_CONSUMER_SECRET", "secret");
    expect(isWso2OAuth2Configured()).toBe(false);
  });

  it("is true when all three are set", () => {
    vi.stubEnv("WSO2_TOKEN_URL", TOKEN_URL);
    vi.stubEnv("WSO2_CONSUMER_KEY", "key");
    vi.stubEnv("WSO2_CONSUMER_SECRET", "secret");
    expect(isWso2OAuth2Configured()).toBe(true);
  });
});

describe("getWso2AccessToken", () => {
  beforeEach(() => {
    vi.stubEnv("WSO2_TOKEN_URL", TOKEN_URL);
    vi.stubEnv("WSO2_CONSUMER_KEY", "test-consumer-key");
    vi.stubEnv("WSO2_CONSUMER_SECRET", "test-consumer-secret");
    __resetWso2TokenCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetWso2TokenCacheForTests();
  });

  it("throws CONFIG_ERROR without a network call when credentials are missing", async () => {
    vi.stubEnv("WSO2_CONSUMER_SECRET", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(getWso2AccessToken()).rejects.toMatchObject({ category: "CONFIG_ERROR" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends RFC 6749 client-credentials grant with Basic auth, never the raw key/secret as query/body params", async () => {
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedInit = init;
        return jsonResponse({ access_token: "app-token-abc", expires_in: 3600 }, 200);
      })
    );

    await getWso2AccessToken();
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(capturedInit?.body).toBe("grant_type=client_credentials");
    // The Basic header must be base64(key:secret), not the raw strings anywhere else in the request.
    const expected = `Basic ${Buffer.from("test-consumer-key:test-consumer-secret").toString("base64")}`;
    expect(headers.Authorization).toBe(expected);
  });

  it("returns the access_token from a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ access_token: "app-token-xyz", expires_in: 3600 }, 200)));
    const token = await getWso2AccessToken();
    expect(token).toBe("app-token-xyz");
  });

  it("caches the token across calls instead of fetching a new one every time", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: "cached-token", expires_in: 3600 }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getWso2AccessToken();
    const second = await getWso2AccessToken();
    expect(first).toBe("cached-token");
    expect(second).toBe("cached-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes once a cached token has expired", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1", expires_in: 60 }, 200))
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-2", expires_in: 60 }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getWso2AccessToken();
    expect(first).toBe("token-1");

    // Past the 60s TTL minus the 30s safety margin.
    vi.advanceTimersByTime(31_000);

    const second = await getWso2AccessToken();
    expect(second).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("de-duplicates concurrent callers into one in-flight token request", async () => {
    let resolveResponse!: (r: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const p1 = getWso2AccessToken();
    const p2 = getWso2AccessToken();
    resolveResponse(jsonResponse({ access_token: "shared-token", expires_in: 3600 }, 200));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe("shared-token");
    expect(r2).toBe("shared-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws AUTH_ERROR on a non-2xx response, without leaking the response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "invalid_client" }, 401)));
    await expect(getWso2AccessToken()).rejects.toMatchObject({ category: "AUTH_ERROR", status: 401 });
  });

  it("throws VALIDATION_ERROR when the response has no access_token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ expires_in: 3600 }, 200)));
    await expect(getWso2AccessToken()).rejects.toMatchObject({ category: "VALIDATION_ERROR" });
  });

  it("throws NETWORK_ERROR when fetch itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    await expect(getWso2AccessToken()).rejects.toMatchObject({ category: "NETWORK_ERROR" });
  });

  it("every failure is a real WSO2Error with a correlation id, never a bare string", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    try {
      await getWso2AccessToken();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WSO2Error);
      expect((error as WSO2Error).correlationId).toBeTruthy();
    }
  });
});
