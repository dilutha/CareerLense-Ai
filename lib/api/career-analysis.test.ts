import { describe, expect, it } from "vitest";
import { CareerAnalysisRequestSchema } from "./career-analysis";

describe("CareerAnalysisRequestSchema", () => {
  it("accepts a valid request with a careerGoal and skills", () => {
    const result = CareerAnalysisRequestSchema.safeParse({
      careerGoal: "Data Analyst",
      skills: ["Python", "SQL", "Power BI"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults skills to an empty array when omitted", () => {
    const result = CareerAnalysisRequestSchema.safeParse({ careerGoal: "Data Analyst" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.skills).toEqual([]);
  });

  it("rejects a missing careerGoal", () => {
    expect(CareerAnalysisRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty careerGoal", () => {
    expect(CareerAnalysisRequestSchema.safeParse({ careerGoal: "" }).success).toBe(false);
  });

  it("rejects a careerGoal that's absurdly long (malformed/abusive input)", () => {
    const result = CareerAnalysisRequestSchema.safeParse({ careerGoal: "x".repeat(500) });
    expect(result.success).toBe(false);
  });

  it("rejects a non-array skills field", () => {
    const result = CareerAnalysisRequestSchema.safeParse({ careerGoal: "Data Analyst", skills: "Python" });
    expect(result.success).toBe(false);
  });

  it("rejects more than 30 skills (malformed/abusive input)", () => {
    const result = CareerAnalysisRequestSchema.safeParse({
      careerGoal: "Data Analyst",
      skills: Array.from({ length: 31 }, (_, i) => `skill-${i}`),
    });
    expect(result.success).toBe(false);
  });
});
