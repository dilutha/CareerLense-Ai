import { describe, expect, it } from "vitest";
import { computeAnswerQualityScore } from "./score";
import type { AnswerFinding } from "./schemas";

describe("computeAnswerQualityScore", () => {
  it("computes a base 'Answer Quality Score' of 70 with no findings for a dimension", () => {
    const { breakdown } = computeAnswerQualityScore([{ dimension: "clarity", impact: 0, note: "t" }]);
    expect(breakdown.relevance).toBe(70);
  });

  it("weights relevance and technical_accuracy highest (25% each)", () => {
    const tankedRelevance = computeAnswerQualityScore([{ dimension: "relevance", impact: -15, note: "t" }]);
    const tankedConciseness = computeAnswerQualityScore([{ dimension: "conciseness", impact: -15, note: "t" }]);
    expect(tankedRelevance.overall).toBeLessThan(tankedConciseness.overall);
  });

  it("clamps to [0, 100]", () => {
    const findings: AnswerFinding[] = Array.from({ length: 10 }, () => ({
      dimension: "structure",
      impact: 15,
      note: "t",
    }));
    const { breakdown } = computeAnswerQualityScore(findings);
    expect(breakdown.structure).toBe(100);
  });

  it("has no 'confidence' dimension — text-based confidence measurement is deliberately not attempted", () => {
    const { breakdown } = computeAnswerQualityScore([{ dimension: "clarity", impact: 0, note: "t" }]);
    expect(breakdown).not.toHaveProperty("confidence");
  });
});
