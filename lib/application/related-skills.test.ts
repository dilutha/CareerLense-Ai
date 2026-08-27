import { describe, expect, it } from "vitest";
import { findRelatedSkill } from "./related-skills";

describe("findRelatedSkill", () => {
  it("finds the PROJECT_SPEC worked example: Tableau required, candidate has Power BI", () => {
    expect(findRelatedSkill("Tableau", ["Power BI", "Excel"])).toBe("Power BI");
  });

  it("returns null when the candidate has the exact skill (that's a full match, not partial)", () => {
    // findRelatedSkill excludes the target itself from the group search.
    expect(findRelatedSkill("Tableau", ["Tableau"])).toBeNull();
  });

  it("returns null when the candidate has nothing in the related group", () => {
    expect(findRelatedSkill("Tableau", ["React", "Node.js"])).toBeNull();
  });

  it("returns null for a skill with no configured related group, never inventing a relation", () => {
    expect(findRelatedSkill("Underwater Basket Weaving", ["Tableau", "Power BI"])).toBeNull();
  });

  it("is case-insensitive on both sides", () => {
    expect(findRelatedSkill("TABLEAU", ["power bi"])).toBe("power bi");
  });
});
