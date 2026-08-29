import { describe, expect, it } from "vitest";
import { normalizeGitHubResponse, parseGitHubUsername } from "./github-api";

describe("parseGitHubUsername", () => {
  it("accepts a bare username", () => {
    expect(parseGitHubUsername("octocat")).toBe("octocat");
  });

  it("extracts the username from a full profile URL", () => {
    expect(parseGitHubUsername("https://github.com/octocat")).toBe("octocat");
    expect(parseGitHubUsername("github.com/octocat/")).toBe("octocat");
  });

  it("strips a leading @", () => {
    expect(parseGitHubUsername("@octocat")).toBe("octocat");
  });

  it("rejects an invalid username", () => {
    expect(parseGitHubUsername("not a username!!")).toBeNull();
    expect(parseGitHubUsername("")).toBeNull();
    expect(parseGitHubUsername("-leading-hyphen")).toBeNull();
  });
});

describe("normalizeGitHubResponse", () => {
  it("normalizes a well-formed real-shaped API response", () => {
    const result = normalizeGitHubResponse(
      "octocat",
      { name: "The Octocat", bio: "GitHub mascot", public_repos: 8, followers: 4000 },
      [
        {
          name: "Hello-World",
          description: "My first repo",
          language: "Python",
          stargazers_count: 10,
          forks_count: 2,
          fork: false,
          updated_at: "2026-01-01T00:00:00Z",
          html_url: "https://github.com/octocat/Hello-World",
        },
      ]
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.profile.username).toBe("octocat");
      expect(result.profile.repos).toHaveLength(1);
      expect(result.profile.repos[0].name).toBe("Hello-World");
      expect(result.profile.repos[0].language).toBe("Python");
    }
  });

  it("filters out forked repositories — only original public work is analyzed", () => {
    const result = normalizeGitHubResponse(
      "octocat",
      { name: null, bio: null, public_repos: 2, followers: 0 },
      [
        { name: "own-repo", fork: false, stargazers_count: 0, forks_count: 0 },
        { name: "forked-repo", fork: true, stargazers_count: 0, forks_count: 0 },
      ]
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.profile.repos.map((r) => r.name)).toEqual(["own-repo"]);
    }
  });

  it("never invents a bio/name when GitHub returns null", () => {
    const result = normalizeGitHubResponse("octocat", { public_repos: 0, followers: 0 }, []);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.profile.bio).toBeNull();
      expect(result.profile.name).toBeNull();
    }
  });

  it("handles a malformed/empty repos array without throwing", () => {
    const result = normalizeGitHubResponse("octocat", { public_repos: 0, followers: 0 }, []);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.profile.repos).toEqual([]);
    }
  });

  it("detects a profile README convention repo (repo named exactly the username)", () => {
    const result = normalizeGitHubResponse(
      "octocat",
      { public_repos: 1, followers: 0 },
      [{ name: "octocat", fork: false, stargazers_count: 0, forks_count: 0 }]
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.profile.hasProfileReadme).toBe(true);
    }
  });
});
