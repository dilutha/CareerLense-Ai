import { describe, expect, it } from "vitest";
import { classifyFreshness, freshnessAdjustment } from "./freshness";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe("classifyFreshness", () => {
  it("classifies a job posted today as Fresh", () => {
    expect(classifyFreshness(daysAgo(0), null)).toBe("Fresh");
  });

  it("classifies a job posted 10 days ago as Recent", () => {
    expect(classifyFreshness(daysAgo(10), null)).toBe("Recent");
  });

  it("classifies a job posted 30 days ago as Older", () => {
    expect(classifyFreshness(daysAgo(30), null)).toBe("Older");
  });

  it("returns Unknown when neither timestamp is available", () => {
    expect(classifyFreshness(null, null)).toBe("Unknown");
  });

  it("falls back to firstSeenAt when postedAt is unavailable", () => {
    expect(classifyFreshness(null, daysAgo(1))).toBe("Fresh");
  });

  it("prefers postedAt over firstSeenAt when both are present", () => {
    expect(classifyFreshness(daysAgo(30), daysAgo(0))).toBe("Older");
  });

  it("does not claim freshness for a bad/unparseable date", () => {
    expect(classifyFreshness("not-a-date", null)).toBe("Unknown");
  });
});

describe("freshnessAdjustment", () => {
  it("is small and bounded — never enough to flip a large match-score gap", () => {
    expect(freshnessAdjustment("Fresh")).toBeLessThanOrEqual(4);
    expect(freshnessAdjustment("Older")).toBeGreaterThanOrEqual(0);
    const spread = freshnessAdjustment("Fresh") - freshnessAdjustment("Unknown");
    expect(spread).toBeLessThan(10);
  });

  it("never lets a fresh weak match beat a much stronger older match (worked example)", () => {
    const olderStrongScore = 95 + freshnessAdjustment("Older");
    const freshWeakScore = 65 + freshnessAdjustment("Fresh");
    expect(olderStrongScore).toBeGreaterThan(freshWeakScore);
  });
});
