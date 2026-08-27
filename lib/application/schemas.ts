import { z } from "zod";

// ---------------------------------------------------------------------------
// Deterministic resume-vs-job comparison output (lib/application/compare.ts).
// Not Gemini output — Zod here is just a runtime-safe shape for what's
// stored in application_analyses.skill_comparison / .keyword_comparison.
// ---------------------------------------------------------------------------

export const SKILL_MATCH_CATEGORIES = [
  "strong_match",
  "match",
  "partial",
  "missing",
  "insufficient_evidence",
] as const;

export type SkillMatchCategory = (typeof SKILL_MATCH_CATEGORIES)[number];

export const SkillComparisonEntrySchema = z.object({
  skill: z.string(),
  category: z.enum(SKILL_MATCH_CATEGORIES),
  importance: z.enum(["required", "preferred", "nice_to_have"]),
  /** Present for "partial" — the related skill the candidate actually has. */
  relatedSkillFound: z.string().nullable(),
});
export type SkillComparisonEntry = z.infer<typeof SkillComparisonEntrySchema>;

export const KeywordComparisonEntrySchema = z.object({
  keyword: z.string(),
  status: z.enum(["present", "missing", "weak"]),
});
export type KeywordComparisonEntry = z.infer<typeof KeywordComparisonEntrySchema>;

// ---------------------------------------------------------------------------
// Tailored CV — Gemini structured output. Deliberately mirrors resume
// ResumeParsedData's shape (lib/resume/schemas.ts) rather than reusing it
// directly — this is a distinct, rewritten deliverable, not a copy of the
// original, and keeping the schema separate makes that boundary explicit.
// ---------------------------------------------------------------------------

export const TailoredEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  dateRange: z.string().nullable(),
});

export const TailoredExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  dateRange: z.string().nullable(),
  bullets: z.array(z.string()).default([]),
});

export const TailoredProjectSchema = z.object({
  name: z.string(),
  technologies: z.array(z.string()).default([]),
  bullets: z.array(z.string()).default([]),
});

export const TailoredContentSchema = z.object({
  professionalSummary: z.string(),
  skills: z.array(z.string()).default([]),
  education: z.array(TailoredEducationSchema).default([]),
  experience: z.array(TailoredExperienceSchema).default([]),
  projects: z.array(TailoredProjectSchema).default([]),
  certifications: z.array(z.string()).default([]),
});
export type TailoredContent = z.infer<typeof TailoredContentSchema>;

export const TailoringNoteSchema = z.object({
  section: z.string(),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
});
export type TailoringNote = z.infer<typeof TailoringNoteSchema>;

export const TailorResumeOutputSchema = z.object({
  tailoredContent: TailoredContentSchema,
  notes: z.array(TailoringNoteSchema).default([]),
});
export type TailorResumeOutput = z.infer<typeof TailorResumeOutputSchema>;
