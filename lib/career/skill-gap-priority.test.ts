import { describe, expect, it } from "vitest";
import { prioritizeSkillGaps } from "./skill-gap-priority";
import type { ClassifiedSkill } from "./market-skills";

function skill(overrides: Partial<ClassifiedSkill>): ClassifiedSkill {
  return { skill: "SQL", classification: "missing", demandPercent: 0, relatedSkillFound: null, ...overrides };
}

describe("prioritizeSkillGaps", () => {
  it("returns an empty array when there are no missing/developing skills", () => {
    const classified: ClassifiedSkill[] = [skill({ classification: "strong", demandPercent: 90 })];
    expect(prioritizeSkillGaps(classified)).toEqual([]);
  });

  it("excludes 'emerging' skills from priority (low demand, not worth prioritizing)", () => {
    const classified: ClassifiedSkill[] = [skill({ classification: "emerging", demandPercent: 10 })];
    expect(prioritizeSkillGaps(classified)).toEqual([]);
  });

  it("classifies priority bands correctly by demand percent", () => {
    const classified: ClassifiedSkill[] = [
      skill({ skill: "SQL", classification: "missing", demandPercent: 60 }),
      skill({ skill: "Excel", classification: "missing", demandPercent: 30 }),
      skill({ skill: "R", classification: "missing", demandPercent: 10 }),
    ];
    const result = prioritizeSkillGaps(classified);
    expect(result.find((r) => r.skill === "SQL")?.priority).toBe("high");
    expect(result.find((r) => r.skill === "Excel")?.priority).toBe("medium");
    expect(result.find((r) => r.skill === "R")?.priority).toBe("low");
  });

  it("sorts by demand percent descending", () => {
    const classified: ClassifiedSkill[] = [
      skill({ skill: "Low", classification: "missing", demandPercent: 30 }),
      skill({ skill: "High", classification: "missing", demandPercent: 80 }),
    ];
    const result = prioritizeSkillGaps(classified);
    expect(result.map((r) => r.skill)).toEqual(["High", "Low"]);
  });

  it("gives a 'developing' skill a reason mentioning the related evidence found", () => {
    const classified: ClassifiedSkill[] = [
      skill({ skill: "TypeScript", classification: "developing", demandPercent: 55, relatedSkillFound: "JavaScript" }),
    ];
    const result = prioritizeSkillGaps(classified);
    expect(result[0].reason).toContain("JavaScript");
  });
});
