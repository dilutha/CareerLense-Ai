import { describe, expect, it } from "vitest";
import { computeCareerReadiness } from "./readiness";

describe("computeCareerReadiness", () => {
  it("returns overall: null when nothing has been analyzed", () => {
    const result = computeCareerReadiness({});
    expect(result.overall).toBeNull();
    expect(result.analyzedComponents).toEqual([]);
  });

  it("computes a full weighted average when every component is analyzed", () => {
    // All components at the same score -> overall must equal that score exactly.
    const result = computeCareerReadiness({
      cv: 80,
      portfolio: 80,
      skills: 80,
      projects: 80,
      linkedin: 80,
      github: 80,
      interview: 80,
      applications: 80,
    });
    expect(result.overall).toBe(80);
    expect(result.hasUnanalyzedComponents).toBe(false);
  });

  it("PROJECT_SPEC's own acceptance test: missing interview is renormalized, never treated as 0", () => {
    // CV=85(18), Portfolio=65(18), GitHub=82(8), Skills=88(18), LinkedIn=70(8) — Projects, Interview & Applications not analyzed.
    const result = computeCareerReadiness({
      cv: 85,
      portfolio: 65,
      github: 82,
      skills: 88,
      linkedin: 70,
    });

    expect(result.hasUnanalyzedComponents).toBe(true);
    expect(result.components.interview).toBeNull();
    expect(result.components.projects).toBeNull();
    expect(result.components.applications).toBeNull();

    // Manually computed weighted average over only the 5 analyzed components:
    // totalWeight = 18+18+8+18+8 = 70
    // weightedSum = 85*18 + 65*18 + 82*8 + 88*18 + 70*8 = 1530+1170+656+1584+560 = 5500
    // overall = round(5500/70) = 79 (would be very different if the unanalyzed components counted as 0)
    expect(result.overall).toBe(79);
  });

  it("a single analyzed component still produces a valid overall (its own score)", () => {
    const result = computeCareerReadiness({ cv: 60 });
    expect(result.overall).toBe(60);
  });
});
