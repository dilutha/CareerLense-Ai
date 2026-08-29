import { describe, expect, it } from "vitest";
import { computeLinkedInScore } from "./score";
import type { LinkedInFinding } from "./schemas";

function finding(overrides: Partial<LinkedInFinding>): LinkedInFinding {
  return { label: "t", category: "positioning", severity: "medium", impact: 0, explanation: "t", ...overrides };
}

describe("computeLinkedInScore", () => {
  it("weights About highest (30%)", () => {
    const tankedAbout = computeLinkedInScore([finding({ category: "about", impact: -15 })]);
    const tankedPositioning = computeLinkedInScore([finding({ category: "positioning", impact: -15 })]);
    expect(tankedAbout.overall).toBeLessThan(tankedPositioning.overall);
  });

  it("defaults to base score 75 across categories with no findings", () => {
    const { overall } = computeLinkedInScore([finding({ category: "headline", impact: 0 })]);
    expect(overall).toBe(75);
  });
});
