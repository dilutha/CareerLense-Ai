import { describe, expect, it } from "vitest";
import { CareerAgentStateSchema, StateUpdateSchema, emptyAgentState } from "./schema";

describe("CareerAgentStateSchema", () => {
  it("produces a fully-defaulted empty state from {}", () => {
    const state = emptyAgentState();
    expect(state.intent).toBeNull();
    expect(state.targetRole).toBeNull();
    expect(state.locations).toEqual([]);
    expect(state.lastResultJobIds).toEqual([]);
  });

  it("accepts a fully-populated valid state", () => {
    const result = CareerAgentStateSchema.safeParse({
      intent: "job_search",
      targetRole: "Data Analyst",
      seniority: "internship",
      locations: ["Colombo"],
      workModes: ["hybrid"],
      selectedJobId: "job-1",
      lastResultJobIds: ["job-1", "job-2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid enum value rather than silently accepting it (never hallucinated shape)", () => {
    const result = CareerAgentStateSchema.safeParse({ seniority: "expert_wizard" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid workMode value", () => {
    const result = CareerAgentStateSchema.safeParse({ workModes: ["flying"] });
    expect(result.success).toBe(false);
  });

  it("silently strips unrecognized extra keys rather than accepting arbitrary Gemini noise as state", () => {
    const result = CareerAgentStateSchema.safeParse({ targetRole: "Data Analyst", somethingGeminiInvented: "xyz" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).somethingGeminiInvented).toBeUndefined();
    }
  });
});

describe("StateUpdateSchema", () => {
  it("defaults referencedResultIndex to null and wantsMoreResults to false", () => {
    const result = StateUpdateSchema.parse({});
    expect(result.referencedResultIndex).toBeNull();
    expect(result.wantsMoreResults).toBe(false);
  });

  it("accepts an update touching only one field, leaving the rest absent", () => {
    const result = StateUpdateSchema.safeParse({ internationalPreference: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetRole).toBeUndefined();
    }
  });

  it("rejects a referencedResultIndex out of the 1-10 range", () => {
    expect(StateUpdateSchema.safeParse({ referencedResultIndex: 0 }).success).toBe(false);
    expect(StateUpdateSchema.safeParse({ referencedResultIndex: 11 }).success).toBe(false);
  });
});
