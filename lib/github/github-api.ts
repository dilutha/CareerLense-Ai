import "server-only";
import crypto from "node:crypto";
import { GitHubProfileDataSchema, type GitHubProfileData } from "./schemas";

const GITHUB_API_BASE = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_REPOS_ANALYZED = 15;

/**
 * Accepts either a bare username or a full profile URL
 * (github.com/username, with or without a trailing slash/path).
 */
export function parseGitHubUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/github\.com\/([a-zA-Z0-9-]+)/i);
  const candidate = urlMatch ? urlMatch[1] : trimmed.replace(/^@/, "");

  // GitHub usernames: alphanumeric + single hyphens, 1-39 chars.
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(candidate) ? candidate : null;
}

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubFetch(path: string): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, {
      signal: controller.signal,
      headers: authHeaders(),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: await response.json() };
  } finally {
    clearTimeout(timeout);
  }
}

export type GitHubFetchResult =
  | { success: true; profile: GitHubProfileData }
  | { success: false; reason: string; status: "not_found" | "rate_limited" | "error" };

/**
 * Fetches a public GitHub profile + repos via the official public REST
 * API — never scrapes github.com pages, never requests private-repo
 * scopes, never asks for a password. GITHUB_TOKEN is optional (raises the
 * unauthenticated 60-req/hr rate limit if set) — this provider works
 * without it, just at that lower limit.
 */
export async function fetchGitHubProfile(username: string): Promise<GitHubFetchResult> {
  const userResult = await githubFetch(`/users/${encodeURIComponent(username)}`);
  if (!userResult.ok) {
    if (userResult.status === 404) {
      return { success: false, reason: `GitHub user "${username}" doesn't exist.`, status: "not_found" };
    }
    if (userResult.status === 403) {
      return {
        success: false,
        reason: "GitHub's public API rate limit was hit — try again in a few minutes.",
        status: "rate_limited",
      };
    }
    return { success: false, reason: "Couldn't reach GitHub right now.", status: "error" };
  }

  const reposResult = await githubFetch(
    `/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=${MAX_REPOS_ANALYZED}`
  );
  const rawRepos = reposResult.ok && Array.isArray(reposResult.data) ? reposResult.data : [];

  return normalizeGitHubResponse(username, userResult.data as Record<string, unknown>, rawRepos as Record<string, unknown>[]);
}

/**
 * Pure normalization from GitHub's raw API JSON shapes into
 * GitHubProfileData — separated from the fetch above so it's directly
 * unit-testable against canned responses (malformed/missing fields
 * included), the same pattern as lib/jobs/providers/itpro.ts.
 */
export function normalizeGitHubResponse(
  username: string,
  rawUser: Record<string, unknown>,
  rawRepos: Record<string, unknown>[]
): GitHubFetchResult {
  // A public repo named exactly "<username>/<username>" with a README is
  // GitHub's convention for a profile README — check without fetching
  // file content (that would need another request per user; not worth it
  // for a boolean signal).
  const hasProfileReadme = rawRepos.some(
    (r) => typeof r.name === "string" && r.name.toLowerCase() === username.toLowerCase()
  );

  const repos = rawRepos
    .filter((r) => !r.fork)
    .slice(0, MAX_REPOS_ANALYZED)
    .map((r) => ({
      name: String(r.name ?? ""),
      description: (r.description as string) ?? null,
      language: (r.language as string) ?? null,
      stars: Number(r.stargazers_count ?? 0),
      forks: Number(r.forks_count ?? 0),
      // The repos list endpoint doesn't tell us README presence directly;
      // a non-null description is used as a light proxy signal alongside
      // Gemini's own read of the (already public) repo description text —
      // never claimed as "we verified the README", see analyze-github.ts.
      hasReadme: Boolean(r.description),
      isFork: Boolean(r.fork),
      updatedAt: (r.updated_at as string) ?? null,
      url: String(r.html_url ?? `https://github.com/${username}/${r.name}`),
    }));

  const candidate = {
    username,
    name: (rawUser.name as string) ?? null,
    bio: (rawUser.bio as string) ?? null,
    publicRepoCount: Number(rawUser.public_repos ?? 0),
    followers: Number(rawUser.followers ?? 0),
    hasProfileReadme,
    repos,
  };

  const parsed = GitHubProfileDataSchema.safeParse(candidate);
  if (!parsed.success) {
    return { success: false, reason: "GitHub returned an unexpected response shape.", status: "error" };
  }

  return { success: true, profile: parsed.data };
}

export function computeGitHubContentHash(profile: GitHubProfileData): string {
  const key = [
    profile.username,
    profile.bio ?? "",
    profile.publicRepoCount,
    ...profile.repos.map((r) => `${r.name}:${r.updatedAt}:${r.description ?? ""}`),
  ].join("|");
  return crypto.createHash("sha256").update(key).digest("hex");
}
