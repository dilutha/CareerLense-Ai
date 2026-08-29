import { describe, expect, it } from "vitest";
import { computePortfolioScore } from "./score";
import type { PortfolioFinding } from "./schemas";

function finding(overrides: Partial<PortfolioFinding>): PortfolioFinding {
  return {
    label: "test",
    category: "seo",
    severity: "medium",
    impact: 0,
    explanation: "test",
    ...overrides,
  };
}

describe("computePortfolioScore", () => {
  it("returns the base score (75) per category with no findings in that category", () => {
    const { breakdown } = computePortfolioScore([finding({ category: "seo", impact: 0 })]);
    expect(breakdown.career_positioning).toBe(75);
  });

  it("clamps a category score to [0, 100]", () => {
    const findings = Array.from({ length: 10 }, () => finding({ category: "seo", impact: -15 }));
    const { breakdown } = computePortfolioScore(findings);
    expect(breakdown.seo).toBe(0);

    const positiveFindings = Array.from({ length: 10 }, () => finding({ category: "seo", impact: 15 }));
    const { breakdown: positiveBreakdown } = computePortfolioScore(positiveFindings);
    expect(positiveBreakdown.seo).toBe(100);
  });

  it("weights categories per PROJECT_SPEC (projects 25% is the largest single weight)", () => {
    // Tank ONLY the projects category — since it has the highest weight (25%),
    // the overall score should drop more than tanking a 10%-weighted category by the same amount.
    const tankedProjects = computePortfolioScore([finding({ category: "projects", impact: -15 })]);
    const tankedSeo = computePortfolioScore([finding({ category: "seo", impact: -15 })]);
    expect(tankedProjects.overall).toBeLessThan(tankedSeo.overall);
  });

  it("never lets Gemini set the overall score directly — it's always derived from findings", () => {
    // No findings at all -> every category at its base of 75 -> overall must be exactly 75.
    const { overall } = computePortfolioScore([finding({ category: "seo", impact: 0 })]);
    expect(overall).toBe(75);
  });
});
