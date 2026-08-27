import { describe, expect, it } from "vitest";
import {
  KeywordComparisonEntrySchema,
  SkillComparisonEntrySchema,
  TailoredContentSchema,
  TailorResumeOutputSchema,
} from "./schemas";

describe("SkillComparisonEntrySchema / KeywordComparisonEntrySchema", () => {
  it("accepts a well-formed deterministic comparison entry", () => {
    const result = SkillComparisonEntrySchema.safeParse({
      skill: "Tableau",
      category: "partial",
      importance: "required",
      relatedSkillFound: "Power BI",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a category outside the fixed, controlled enum (no free-form AI categories)", () => {
    const result = SkillComparisonEntrySchema.safeParse({
      skill: "Tableau",
      category: "probably_fine",
      importance: "required",
      relatedSkillFound: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a keyword status outside present/missing/weak", () => {
    const result = KeywordComparisonEntrySchema.safeParse({ keyword: "SQL", status: "kinda" });
    expect(result.success).toBe(false);
  });
});

describe("TailorResumeOutputSchema — Gemini structured-output validation", () => {
  it("accepts a well-formed tailored CV response", () => {
    const result = TailorResumeOutputSchema.safeParse({
      tailoredContent: {
        professionalSummary: "Final-year CS student with data analysis project experience.",
        skills: ["Python", "SQL"],
        education: [{ institution: "University of Moratuwa", degree: "BSc", field: "CS", dateRange: "2022 – 2026" }],
        experience: [],
        projects: [{ name: "Sales Dashboard", technologies: ["Power BI"], bullets: ["Built a dashboard"] }],
        certifications: [],
      },
      notes: [{ section: "summary", before: "Old text", after: "New text", reason: "Aligned to job keywords" }],
    });
    expect(result.success).toBe(true);
  });

  it("fails validation when a required field like professionalSummary is missing (malformed Gemini response)", () => {
    const result = TailorResumeOutputSchema.safeParse({
      tailoredContent: {
        skills: [],
        education: [],
        experience: [],
        projects: [],
        certifications: [],
      },
      notes: [],
    });
    expect(result.success).toBe(false);
  });

  it("fills in defaults for omitted array fields rather than throwing", () => {
    const result = TailoredContentSchema.safeParse({
      professionalSummary: "A summary.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skills).toEqual([]);
      expect(result.data.projects).toEqual([]);
    }
  });

  it("rejects a non-string bullet (wrong shape from a malformed Gemini response)", () => {
    const result = TailoredContentSchema.safeParse({
      professionalSummary: "A summary.",
      experience: [{ company: "Acme", role: "Intern", dateRange: null, bullets: [42] }],
    });
    expect(result.success).toBe(false);
  });
});
