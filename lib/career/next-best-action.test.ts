import { describe, expect, it } from "vitest";
import { computeCareerReadiness } from "./readiness";
import { computeNextBestAction } from "./next-best-action";

describe("computeNextBestAction", () => {
  it("PROJECT_SPEC's own acceptance test: recommends Portfolio as the primary weakness", () => {
    // CV=85, Portfolio=65, GitHub=82, Skills=88, LinkedIn=70, Interview=not evaluated.
    const readiness = computeCareerReadiness({
      cv: 85,
      portfolio: 65,
      github: 82,
      skills: 88,
      linkedin: 70,
    });

    const action = computeNextBestAction(readiness);
    expect(action?.component).toBe("portfolio");
  });

  it("recommends the component with the largest weight x (100-score) gap, not just the lowest raw score", () => {
    // Portfolio: weight 20, score 60 -> impact 800. GitHub: weight 10, score 20 -> impact 800 (tie by construction below).
    // Use a clean case where impact clearly differs: Skills (weight 20, score 50 -> impact 1000) should beat
    // GitHub (weight 10, score 10 -> impact 900) despite GitHub's lower raw score.
    const readiness = computeCareerReadiness({ skills: 50, github: 10 });
    const action = computeNextBestAction(readiness);
    expect(action?.component).toBe("skills");
  });

  it("falls back to interview practice when everything analyzed is already strong and interview hasn't been evaluated", () => {
    const readiness = computeCareerReadiness({ cv: 92, portfolio: 90, skills: 88 });
    const action = computeNextBestAction(readiness);
    expect(action?.component).toBe("interview");
  });

  it("returns null when nothing has been analyzed at all", () => {
    const readiness = computeCareerReadiness({});
    expect(computeNextBestAction(readiness)).toBeNull();
  });

  it("never recommends a component that hasn't been analyzed, other than the interview fallback", () => {
    const readiness = computeCareerReadiness({ cv: 40 });
    const action = computeNextBestAction(readiness);
    expect(action?.component).toBe("cv");
  });
});
