import { describe, expect, it } from "vitest";
import { computeSessionSummary } from "./session-summary";
import type { InterviewExchangeRow } from "./types";

function exchange(overrides: Partial<InterviewExchangeRow>): InterviewExchangeRow {
  return {
    id: "e1",
    session_id: "s1",
    profile_id: "p1",
    category: "technical",
    question: "q",
    order_index: 0,
    answer_text: null,
    feedback: null,
    quality_score: null,
    score_breakdown: null,
    created_at: new Date().toISOString(),
    answered_at: null,
    ...overrides,
  };
}

describe("computeSessionSummary", () => {
  it("averages quality_score per category for answered exchanges only", () => {
    const summary = computeSessionSummary([
      exchange({ id: "a", category: "technical", quality_score: 80 }),
      exchange({ id: "b", category: "technical", quality_score: 90 }),
      exchange({ id: "c", category: "behavioral", quality_score: 70 }),
    ]);
    expect(summary.technical).toBe(85);
    expect(summary.behavioral).toBe(70);
    expect(summary.overall).toBe(80);
  });

  it("omits a category entirely when nothing in it has been answered — never defaults to 0", () => {
    const summary = computeSessionSummary([
      exchange({ id: "a", category: "technical", quality_score: 80 }),
      exchange({ id: "b", category: "behavioral", quality_score: null }), // unanswered
    ]);
    expect(summary.technical).toBe(80);
    expect(summary.behavioral).toBeUndefined();
  });

  it("returns overall: null when nothing has been answered yet", () => {
    const summary = computeSessionSummary([exchange({ quality_score: null })]);
    expect(summary.overall).toBeNull();
  });

  it("handles an empty exchange list", () => {
    const summary = computeSessionSummary([]);
    expect(summary.overall).toBeNull();
  });
});
