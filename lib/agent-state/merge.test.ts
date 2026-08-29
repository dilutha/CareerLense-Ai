import { describe, expect, it } from "vitest";
import { mergeAgentState } from "./merge";
import { emptyAgentState } from "./schema";

describe("mergeAgentState", () => {
  it("sets fields from the update onto an empty state", () => {
    const result = mergeAgentState(emptyAgentState(), { intent: "job_search", targetRole: "Data Analyst", seniority: "internship" });
    expect(result.targetRole).toBe("Data Analyst");
    expect(result.seniority).toBe("internship");
    expect(result.intent).toBe("job_search");
  });

  it("leaves fields absent from the update untouched", () => {
    const current = mergeAgentState(emptyAgentState(), { targetRole: "Data Analyst", locations: ["Colombo"] });
    const result = mergeAgentState(current, { internationalPreference: true });
    expect(result.targetRole).toBe("Data Analyst");
    expect(result.locations).toEqual(["Colombo"]);
    expect(result.internationalPreference).toBe(true);
  });

  it("replaces a location constraint wholesale — 'Colombo only' then 'anywhere in Sri Lanka'", () => {
    const afterColombo = mergeAgentState(emptyAgentState(), { locations: ["Colombo"] });
    expect(afterColombo.locations).toEqual(["Colombo"]);

    // Extraction resolved "anywhere in Sri Lanka" as a broader preference that supersedes the specific city.
    const afterBroaden = mergeAgentState(afterColombo, { locations: [] });
    expect(afterBroaden.locations).toEqual([]);
  });

  it("adds to an existing preference when the update's array already includes the old value — 'remote only' then 'actually hybrid is okay'", () => {
    const afterRemote = mergeAgentState(emptyAgentState(), { workModes: ["remote"] });
    expect(afterRemote.workModes).toEqual(["remote"]);

    const afterAddHybrid = mergeAgentState(afterRemote, { workModes: ["remote", "hybrid"] });
    expect(afterAddHybrid.workModes).toEqual(["remote", "hybrid"]);
  });

  it("accumulates independent preferences across turns — international added without disturbing an earlier remote preference", () => {
    const afterRemote = mergeAgentState(emptyAgentState(), { workModes: ["remote"] });
    const afterInternational = mergeAgentState(afterRemote, { internationalPreference: true });
    expect(afterInternational.workModes).toEqual(["remote"]);
    expect(afterInternational.internationalPreference).toBe(true);
  });

  it("applies negative preferences (excludedRoles) without touching unrelated fields", () => {
    const withRole = mergeAgentState(emptyAgentState(), { targetRole: "Data Analyst" });
    const withExclusion = mergeAgentState(withRole, { excludedRoles: ["call center", "sales"] });
    expect(withExclusion.targetRole).toBe("Data Analyst");
    expect(withExclusion.excludedRoles).toEqual(["call center", "sales"]);
  });

  it("does not mutate the original state object (pure function)", () => {
    const current = emptyAgentState();
    const frozenCopy = { ...current };
    mergeAgentState(current, { targetRole: "Data Analyst" });
    expect(current).toEqual(frozenCopy);
  });
});
