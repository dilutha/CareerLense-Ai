import { describe, expect, it } from "vitest";
import { buildRoadmapPlan } from "./build-plan";
import type { PrioritizedSkillGap } from "@/lib/career/skill-gap-priority";

function gap(skill: string, priority: PrioritizedSkillGap["priority"] = "high", demandPercent = 60): PrioritizedSkillGap {
  return { skill, priority, demandPercent, reason: `${demandPercent}% of jobs mention ${skill}.` };
}

describe("buildRoadmapPlan", () => {
  it("always appends an 'Apply to roles' step, even with zero skill gaps", () => {
    const steps = buildRoadmapPlan([], "Data Analyst", null);
    expect(steps).toHaveLength(1);
    expect(steps[0].title).toContain("Apply to");
    expect(steps[0].title).toContain("Data Analyst");
  });

  it("caps skill steps at 4 even when given more gaps", () => {
    const gaps = [gap("SQL"), gap("Python"), gap("Excel"), gap("Tableau"), gap("R"), gap("Power BI")];
    const steps = buildRoadmapPlan(gaps, "Data Analyst", null);
    const skillSteps = steps.filter((s) => s.title.startsWith("Learn "));
    expect(skillSteps).toHaveLength(4);
  });

  it("adds a project step demonstrating the top-priority skill when gaps exist", () => {
    const steps = buildRoadmapPlan([gap("Python")], "Data Analyst", null);
    const projectStep = steps.find((s) => s.resourceType === "project");
    expect(projectStep).toBeDefined();
    expect(projectStep!.title).toContain("Python");
  });

  it("only ever uses curated catalog URLs — never fabricates one for an unlisted skill", () => {
    const steps = buildRoadmapPlan([gap("SomeObscureUnlistedSkill")], "Data Analyst", null);
    const step = steps.find((s) => s.skill === "SomeObscureUnlistedSkill");
    expect(step!.resourceUrl).toBeNull();
    expect(step!.resourceNote).toContain("Search for");
  });

  it("uses a real catalog URL for a known skill like python", () => {
    const steps = buildRoadmapPlan([gap("python")], "Data Analyst", null);
    const step = steps.find((s) => s.skill === "python");
    expect(step!.resourceUrl).toMatch(/^https:\/\//);
  });

  it("step_order is sequential starting at 0 with no gaps", () => {
    const steps = buildRoadmapPlan([gap("SQL")], "Data Analyst", "entry-level");
    expect(steps.map((s) => s.stepOrder)).toEqual(steps.map((_, i) => i));
  });
});
