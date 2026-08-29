import { describe, expect, it } from "vitest";
import { buildSearchCriteria } from "./build-search-criteria";
import { emptyAgentState } from "./schema";

describe("buildSearchCriteria", () => {
  it("maps targetRole/locations/workModes/seniority onto the existing JobSearchQuery shape", () => {
    const state = {
      ...emptyAgentState(),
      targetRole: "Data Analyst",
      locations: ["Colombo"],
      workModes: ["hybrid" as const],
      seniority: "internship" as const,
    };
    const criteria = buildSearchCriteria(state, 20);
    expect(criteria.role).toBe("Data Analyst");
    expect(criteria.location).toBe("Colombo");
    expect(criteria.workMode).toBe("hybrid");
    expect(criteria.level).toBe("internship");
    expect(criteria.limit).toBe(20);
  });

  it("maps the 'mid' seniority value onto the existing schema's 'mid_level' — the two enums don't share the same spelling", () => {
    const state = { ...emptyAgentState(), seniority: "mid" as const };
    expect(buildSearchCriteria(state, 20).level).toBe("mid_level");
  });

  it("uses null role/location/workMode/level when nothing is known — never invents a default", () => {
    const criteria = buildSearchCriteria(emptyAgentState(), 20);
    expect(criteria.role).toBeNull();
    expect(criteria.location).toBeNull();
    expect(criteria.workMode).toBeNull();
    expect(criteria.level).toBeNull();
  });

  it("folds company type / international / technology preferences into keywords, since JobSearchQuery has no such fields", () => {
    const state = {
      ...emptyAgentState(),
      internationalPreference: true,
      companyTypes: ["multinational" as const],
      technologies: ["ERP"],
    };
    const criteria = buildSearchCriteria(state, 20);
    expect(criteria.keywords).toContain("international");
    expect(criteria.keywords).toContain("multinational");
    expect(criteria.keywords).toContain("ERP");
  });

  it("never includes 'any' as a literal keyword for an 'any' companyType", () => {
    const state = { ...emptyAgentState(), companyTypes: ["any" as const] };
    const criteria = buildSearchCriteria(state, 20);
    expect(criteria.keywords).not.toContain("any");
  });

  it("caps keywords at 10 even with many preferences combined", () => {
    const state = {
      ...emptyAgentState(),
      keywords: ["a", "b", "c", "d", "e"],
      technologies: ["f", "g", "h", "i", "j"],
      skills: ["k", "l"],
    };
    const criteria = buildSearchCriteria(state, 20);
    expect(criteria.keywords?.length).toBeLessThanOrEqual(10);
  });
});
