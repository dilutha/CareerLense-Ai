import { describe, expect, it } from "vitest";
import { canonicalizeSkill, hasEquivalentSkill, skillsEquivalent } from "./skill-aliases";

describe("canonicalizeSkill", () => {
  it("is case-insensitive", () => {
    expect(canonicalizeSkill("Python")).toBe(canonicalizeSkill("python"));
    expect(canonicalizeSkill("PYTHON")).toBe("python");
  });

  it("maps known aliases to the same canonical form", () => {
    expect(canonicalizeSkill("Postgres")).toBe("postgresql");
    expect(canonicalizeSkill("PostgreSQL")).toBe("postgresql");
    expect(canonicalizeSkill("React.js")).toBe("react");
    expect(canonicalizeSkill("ReactJS")).toBe("react");
    expect(canonicalizeSkill("JS")).toBe("javascript");
  });

  it("leaves unknown skills as trimmed lowercase text, never invents a mapping", () => {
    expect(canonicalizeSkill("  Some Totally Unknown Skill  ")).toBe("some totally unknown skill");
  });
});

describe("skillsEquivalent / hasEquivalentSkill", () => {
  it("treats aliases as equivalent", () => {
    expect(skillsEquivalent("Postgres", "PostgreSQL")).toBe(true);
    expect(skillsEquivalent("React", "Vue")).toBe(false);
  });

  it("finds an equivalent skill anywhere in a candidate list, case-insensitively", () => {
    expect(hasEquivalentSkill("postgresql", ["Django", "Postgres", "Docker"])).toBe(true);
    expect(hasEquivalentSkill("PowerBI", ["Excel", "Power BI"])).toBe(true);
  });

  it("returns false for a skill genuinely absent from the candidate list", () => {
    expect(hasEquivalentSkill("Kubernetes", ["React", "Node.js"])).toBe(false);
  });
});
