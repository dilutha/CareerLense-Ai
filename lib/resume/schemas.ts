import { z } from "zod";

// ---------------------------------------------------------------------------
// Structured data extracted directly from the resume — facts only, never
// evaluative. Every field is nullable/defaulted rather than required, since
// Gemini must return null/empty for anything not actually present instead
// of inventing it.
// ---------------------------------------------------------------------------

export const ResumeContactSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
});

export const ResumeSkillSchema = z.object({
  name: z.string(),
  category: z.string(),
});

export const ResumeEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

export const ResumeExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  description: z.string().nullable(),
});

export const ResumeProjectSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  technologies: z.array(z.string()).default([]),
});

export const ResumeParsedDataSchema = z.object({
  candidate_summary: z.string().nullable(),
  contact: ResumeContactSchema,
  skills: z.array(ResumeSkillSchema).default([]),
  education: z.array(ResumeEducationSchema).default([]),
  experience: z.array(ResumeExperienceSchema).default([]),
  projects: z.array(ResumeProjectSchema).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  sections_detected: z.array(z.string()).default([]),
  missing_sections: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Evaluative findings. Each finding nudges one category's score up or down
// — the final numeric score is computed deterministically in
// analyze-resume.ts from these, never trusted directly from Gemini as a
// single opaque number.
// ---------------------------------------------------------------------------

export const RESUME_SCORE_CATEGORIES = [
  "content",
  "skills",
  "experience",
  "projects",
  "clarity",
  "completeness",
] as const;

export const ResumeScoreCategorySchema = z.enum(RESUME_SCORE_CATEGORIES);

export const ResumeFindingSchema = z.object({
  label: z.string(),
  category: ResumeScoreCategorySchema,
  /** Positive = strength, negative or zero = weakness. */
  impact: z.number().min(-10).max(10),
  explanation: z.string(),
});

/**
 * The single, combined shape Gemini is asked to return for one resume —
 * parsing and evaluation in one call to keep free-tier usage low. Used both
 * to generate the JSON Schema passed to Gemini's structured-output config
 * and to validate the response afterward — one source of truth.
 */
export const GeminiResumeOutputSchema = z.object({
  parsed: ResumeParsedDataSchema,
  summary: z.string().nullable(),
  experience_summary: z.string().nullable(),
  education_summary: z.string().nullable(),
  findings: z.array(ResumeFindingSchema).min(1),
  keyword_suggestions: z.array(z.string()).default([]),
  formatting_feedback: z.array(z.string()).default([]),
});

export type ResumeParsedData = z.infer<typeof ResumeParsedDataSchema>;
export type ResumeFinding = z.infer<typeof ResumeFindingSchema>;
export type ResumeScoreCategory = z.infer<typeof ResumeScoreCategorySchema>;
export type GeminiResumeOutput = z.infer<typeof GeminiResumeOutputSchema>;
