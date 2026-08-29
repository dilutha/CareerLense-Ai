import { describe, expect, it } from "vitest";
import { computeGitHubScore } from "./score";
import type { GitHubFinding } from "./schemas";

function finding(overrides: Partial<GitHubFinding>): GitHubFinding {
  return { label: "t", category: "activity", severity: "medium", impact: 0, explanation: "t", ...overrides };
}

describe("computeGitHubScore", () => {
  it("weights career_relevance highest (30%)", () => {
    const tankedRelevance = computeGitHubScore([finding({ category: "career_relevance", impact: -15 })]);
    const tankedActivity = computeGitHubScore([finding({ category: "activity", impact: -15 })]);
    expect(tankedRelevance.overall).toBeLessThan(tankedActivity.overall);
  });

  it("defaults every category to the base score (75) with no findings", () => {
    const { breakdown } = computeGitHubScore([finding({ category: "activity", impact: 0 })]);
    expect(breakdown.profile_completeness).toBe(75);
    expect(breakdown.documentation).toBe(75);
  });

  it("clamps to [0, 100]", () => {
    const { breakdown } = computeGitHubScore(
      Array.from({ length: 10 }, () => finding({ category: "repository_quality", impact: 15 }))
    );
    expect(breakdown.repository_quality).toBe(100);
  });
});
