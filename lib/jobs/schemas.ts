import { z } from "zod";

// ---------------------------------------------------------------------------
// Search intent — extracted from the user's chat message.
// ---------------------------------------------------------------------------

export const EMPLOYMENT_LEVELS = [
  "internship",
  "graduate",
  "entry_level",
  "junior",
  "mid_level",
  "senior",
  "any",
] as const;

export const WORK_MODES = ["onsite", "hybrid", "remote", "any"] as const;

export const JobSearchIntentSchema = z.object({
  role: z.string().nullable(),
  level: z.enum(EMPLOYMENT_LEVELS).nullable(),
  location: z.string().nullable(),
  country: z.string().default("Sri Lanka"),
  workMode: z.enum(WORK_MODES).nullable(),
  keywords: z.array(z.string()).default([]),
  /** True if the user is asking to search now vs. just chatting about careers. */
  shouldSearch: z.boolean(),
  /** A short clarifying question to ask instead of searching, if too little is known. */
  clarifyingQuestion: z.string().nullable(),
});

export type JobSearchIntent = z.infer<typeof JobSearchIntentSchema>;

// ---------------------------------------------------------------------------
// Normalized job — the shape every provider must produce. The rest of
// CareerLens (matching, storage, UI) only ever operates on this, never a
// provider-specific shape.
// ---------------------------------------------------------------------------

export const EMPLOYMENT_TYPES = [
  "internship",
  "part_time",
  "full_time",
  "contract",
  "freelance",
  "volunteer",
  "other",
] as const;

export const SOURCE_TYPES = ["job_board", "aggregator_result", "official_company", "fixture"] as const;

export const NormalizedJobSchema = z.object({
  source: z.string(),
  /** Human-readable attribution, e.g. "ITPro.lk" — falls back to `source` when unset. */
  sourceName: z.string().nullable().default(null),
  /** job_board (ITPro) / aggregator_result (SerpApi) / official_company (schema.org career pages) / fixture (demo). */
  sourceType: z.enum(SOURCE_TYPES).default("job_board"),
  sourceJobId: z.string().nullable(),
  title: z.string(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  country: z.string().default("Sri Lanka"),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable(),
  workMode: z.enum(["onsite", "hybrid", "remote"]).nullable(),
  description: z.string().nullable(),
  responsibilities: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  salaryText: z.string().nullable(),
  postedAt: z.string().nullable(),
  applicationUrl: z.string().url().refine((url) => url.startsWith("https://"), {
    message: "Application URL must be https://",
  }),
  sourceUrl: z.string().url().nullable(),
});

export type NormalizedJob = z.infer<typeof NormalizedJobSchema>;

// ---------------------------------------------------------------------------
// Gemini job analysis — structured extraction from a normalized job's
// description text. Distinguishes required/preferred, never invents a
// field the source didn't provide.
// ---------------------------------------------------------------------------

export const SKILL_IMPORTANCE = ["required", "preferred", "nice_to_have"] as const;
export const SKILL_TYPES = ["technical", "soft", "tool", "domain", "language"] as const;

export const JobAnalysisSkillSchema = z.object({
  name: z.string(),
  type: z.enum(SKILL_TYPES),
  importance: z.enum(SKILL_IMPORTANCE),
});

export const JobAnalysisSchema = z.object({
  skills: z.array(JobAnalysisSkillSchema).default([]),
  educationRequirements: z.array(z.string()).default([]),
  experienceLevel: z.enum(EMPLOYMENT_LEVELS).nullable(),
  keywords: z.array(z.string()).default([]),
  /** Duties as stated by the listing — used for tailoring (Phase 8), not just matching. */
  responsibilities: z.array(z.string()).default([]),
  /** Soft skills specifically (communication, teamwork, ...) — kept separate from `skills`
   *  so tailoring can address them without conflating with technical requirements. */
  softSkills: z.array(z.string()).default([]),
  /** ATS-relevant terminology/phrasing from the listing (title variants, tool names,
   *  domain jargon) worth echoing in a tailored resume when genuinely true of the candidate. */
  atsTerms: z.array(z.string()).default([]),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;
export type JobAnalysisSkill = z.infer<typeof JobAnalysisSkillSchema>;
