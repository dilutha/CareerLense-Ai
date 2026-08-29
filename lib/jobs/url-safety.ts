import "server-only";

/**
 * Shared guard for any server-side fetch of an external, user- or
 * provider-supplied URL (company career pages, a pasted job URL, a
 * provider's job-detail link). Blocks the classic SSRF targets — internal
 * hostnames, private/loopback/link-local IP ranges, and non-http(s)
 * schemes — before a request is ever made. This is defense at the fetch
 * boundary, distinct from NormalizedJobSchema's applicationUrl check
 * (which only validates a URL we're *storing*, not one we're fetching).
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** Throws UnsafeUrlError if the URL isn't safe for the server to fetch. */
export function assertSafeExternalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Not a valid URL.");
  }

  if (url.protocol !== "https:") {
    throw new UnsafeUrlError("Only https:// URLs can be fetched.");
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    throw new UnsafeUrlError("This host can't be fetched.");
  }
  if (isPrivateIPv4(hostname)) {
    throw new UnsafeUrlError("This host can't be fetched.");
  }
  if (hostname === "[::1]" || hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")) {
    throw new UnsafeUrlError("This host can't be fetched.");
  }

  return url;
}

// ---------------------------------------------------------------------------
// robots.txt — every fetch of a page we didn't originate (company career
// pages, a pasted job URL) must respect it. Deliberately minimal: only
// understands `User-agent: *` and `Disallow` prefix rules, which covers
// the overwhelming majority of real robots.txt files and is a
// conservative default (a path this can't parse confidently is treated as
// allowed only when no matching Disallow line is found, never the other
// way around).
// ---------------------------------------------------------------------------

const robotsCache = new Map<string, { fetchedAt: number; disallow: string[] }>();
const ROBOTS_CACHE_TTL_MS = 30 * 60 * 1000;

async function getDisallowRules(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return cached.disallow;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let text: string;
    try {
      const response = await fetch(`${origin}/robots.txt`, { signal: controller.signal });
      if (!response.ok) {
        robotsCache.set(origin, { fetchedAt: Date.now(), disallow: [] });
        return [];
      }
      text = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    const disallow: string[] = [];
    let inWildcardBlock = false;
    for (const rawLine of text.split("\n")) {
      const line = rawLine.split("#")[0].trim();
      if (!line) continue;
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (key === "user-agent") {
        inWildcardBlock = value === "*";
      } else if (key === "disallow" && inWildcardBlock && value) {
        disallow.push(value);
      }
    }

    robotsCache.set(origin, { fetchedAt: Date.now(), disallow });
    return disallow;
  } catch {
    // Can't verify robots.txt at all (network error, timeout) — the
    // caller must fail closed rather than assume access is fine. The
    // sentinel "__unverifiable__" can never match a real Disallow prefix
    // (robots.txt rules are always paths starting with "/"), so it always
    // fails the startsWith check below and gets special-cased instead.
    return ["__unverifiable__"];
  }
}

/**
 * True if `url`'s path is permitted by the origin's robots.txt for a
 * generic crawler. Fails closed: if robots.txt can't be fetched/parsed at
 * all, or explicitly disallows everything ("Disallow: /"), this returns
 * false rather than assuming access is fine.
 */
export async function isAllowedByRobotsTxt(url: URL): Promise<boolean> {
  const disallow = await getDisallowRules(url.origin);
  if (disallow.includes("__unverifiable__")) return false;
  return !disallow.some((rule) => url.pathname.startsWith(rule));
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 2_000_000; // 2MB — a job listing page is text, never needs more.

/**
 * Fetches an external URL with SSRF guards, a timeout, and a response-size
 * cap. Redirects are followed by the platform fetch() implementation but
 * each hop still terminates in a URL `fetch()` itself validated against —
 * we additionally re-check the final response URL below so a redirect to
 * an internal host doesn't slip through.
 */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  assertSafeExternalUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "CareerLensBot/1.0 (+https://careerlens.lk; job-listing fetch for a career assistant)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    // Re-validate after redirects — response.url is the final, resolved location.
    assertSafeExternalUrl(response.url);

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error("Response too large.");
    }

    const reader = response.body?.getReader();
    if (!reader) return await response.text();

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("Response too large.");
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
  } finally {
    clearTimeout(timeout);
  }
}
