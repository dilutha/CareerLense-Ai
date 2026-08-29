import { describe, expect, it } from "vitest";
import { computeCareerInsights } from "./insights";
import type { ApplicationStats } from "@/lib/applications/stats";

function emptyStats(): ApplicationStats {
  return {
    total: 0,
    active: 0,
    interviews: 0,
    finalRounds: 0,
    offers: 0,
    rejected: 0,
    interviewRate: null,
    offerRate: null,
    responseRate: null,
  };
}

describe("computeCareerInsights", () => {
  it("returns no insights when there is no supporting data at all", () => {
    const insights = computeCareerInsights({
      topSkillGap: null,
      applicationStats: emptyStats(),
      resumePerformance: { entries: [], observation: null },
    });
    expect(insights).toEqual([]);
  });

  it("adds a skill-gap insight only when a top skill gap exists", () => {
    const insights = computeCareerInsights({
      topSkillGap: { skill: "SQL", priority: "high", demandPercent: 60, reason: "60% of jobs mention SQL." },
      applicationStats: emptyStats(),
      resumePerformance: { entries: [], observation: null },
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].text).toContain("SQL");
    expect(insights[0].actionHref).toBe("/career/roadmap");
  });

  it("adds an interview-rate insight only when interview rate is real and >= 25%", () => {
    const stats = { ...emptyStats(), interviewRate: 30 };
    const insights = computeCareerInsights({
      topSkillGap: null,
      applicationStats: stats,
      resumePerformance: { entries: [], observation: null },
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].text).toContain("30%");
  });

  it("does NOT add an interview-rate insight when the rate is null (no data) or below threshold", () => {
    const belowThreshold = computeCareerInsights({
      topSkillGap: null,
      applicationStats: { ...emptyStats(), interviewRate: 10 },
      resumePerformance: { entries: [], observation: null },
    });
    expect(belowThreshold).toEqual([]);

    const noData = computeCareerInsights({
      topSkillGap: null,
      applicationStats: emptyStats(),
      resumePerformance: { entries: [], observation: null },
    });
    expect(noData).toEqual([]);
  });

  it("surfaces a resume-performance observation as an insight when present", () => {
    const insights = computeCareerInsights({
      topSkillGap: null,
      applicationStats: emptyStats(),
      resumePerformance: { entries: [], observation: "CV A has a higher interview rate than CV B." },
    });
    expect(insights).toHaveLength(1);
    expect(insights[0].actionHref).toBe("/analytics");
  });
});
