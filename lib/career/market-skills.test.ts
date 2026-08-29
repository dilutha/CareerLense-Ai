import { describe, expect, it } from "vitest";
import { classifyMarketSkills, type MarketSkillReport } from "./market-skills";

function makeReport(demand: MarketSkillReport["demand"]): MarketSkillReport {
  return { targetRole: "Data Analyst", relevantJobCount: 10, demand, smallSample: false };
}

describe("classifyMarketSkills", () => {
  it("returns an empty array when the report has no demand data", () => {
    expect(classifyMarketSkills(makeReport([]), ["Python"])).toEqual([]);
  });

  it("classifies a skill the candidate already has as 'strong'", () => {
    const report = makeReport([{ skill: "python", demandPercent: 80, requiredCount: 8, preferredCount: 0, jobCount: 8 }]);
    const result = classifyMarketSkills(report, ["Python"]);
    expect(result[0].classification).toBe("strong");
  });

  it("classifies a high-demand skill with no candidate evidence as 'missing'", () => {
    const report = makeReport([{ skill: "sql", demandPercent: 70, requiredCount: 7, preferredCount: 0, jobCount: 7 }]);
    const result = classifyMarketSkills(report, ["Excel"]);
    expect(result[0].classification).toBe("missing");
  });

  it("classifies a low-demand skill with no candidate evidence as 'emerging', not 'missing'", () => {
    const report = makeReport([{ skill: "rust", demandPercent: 15, requiredCount: 1, preferredCount: 0, jobCount: 1 }]);
    const result = classifyMarketSkills(report, ["Excel"]);
    expect(result[0].classification).toBe("emerging");
  });

  it("never invents a demand percentage — passes the report's real percent through unchanged", () => {
    const report = makeReport([{ skill: "sql", demandPercent: 42.5, requiredCount: 4, preferredCount: 0, jobCount: 4 }]);
    const result = classifyMarketSkills(report, []);
    expect(result[0].demandPercent).toBe(42.5);
  });
});
