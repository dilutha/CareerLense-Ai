import { z } from "zod";

/**
 * Persisted, structured state for one conversation's career/job-search
 * context (Phase 21). Deliberately minimal (PROJECT_SPEC's own "keep
 * state minimal" instruction) — every field exists because something in
 * the pipeline actually reads it:
 *   - targetRole/seniority/locations/workModes/technologies/skills/
 *     keywords/industries/companyPreferences feed lib/agent-state/
 *     build-search-criteria.ts (the existing JobSearchQuery, reused as-is).
 *   - excludedRoles/excludedIndustries/excludedCompanies/excludedWorkModes
 *     feed lib/agent-state/apply-filters.ts's deterministic hard filter.
 *   - selectedJobId/lastResultJobIds feed reference resolution ("second
 *     eka") and the selected-job chat context.
 *   - lastSearchAt/missingInformation are display/reasoning aids only.
 *
 * `companyTypes`/`internationalPreference`/`industries`/`technologies`
 * are NOT filtered against a structured "company type" or "industry"
 * field — no job source populates one (see docs/JOB_DATA.md), so
 * pretending to filter on it would silently fabricate a signal the data
 * doesn't have. Instead they become keyword augmentation into the
 * existing search query, letting the EXISTING deterministic keyword-score
 * component (lib/jobs/match.ts) do the actual, honest work.
 */
export const CAREER_AGENT_INTENTS = [
  "job_search",
  "career_advice",
  "resume_help",
  "interview_prep",
  "application_help",
] as const;
export type CareerAgentIntent = (typeof CAREER_AGENT_INTENTS)[number];

export const SENIORITY_LEVELS = ["internship", "entry_level", "junior", "mid", "senior"] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export const WORK_MODE_VALUES = ["onsite", "hybrid", "remote"] as const;
export type WorkModeValue = (typeof WORK_MODE_VALUES)[number];

export const COMPANY_TYPE_VALUES = ["startup", "sme", "enterprise", "multinational", "any"] as const;
export type CompanyTypeValue = (typeof COMPANY_TYPE_VALUES)[number];

const stringArray = z.array(z.string().trim().min(1)).max(10);

/**
 * The field SHAPES with no `.default()`/required-ness baked in — shared
 * by both schemas below. This split exists specifically because Zod's
 * `.partial()` does NOT make an inner `.default()` disappear: a schema
 * built as `CareerAgentStateSchema.partial()` would still populate every
 * absent key with its default value (e.g. `targetRole: null`) rather than
 * leaving it genuinely `undefined` — which would silently break the
 * update schema's entire "a key is only present if this message actually
 * touched it" contract (see merge.ts). Building both schemas from these
 * undecorated shapes, rather than deriving one from the other, keeps that
 * contract real instead of accidentally-satisfied.
 */
const fieldShapes = {
  intent: z.enum(CAREER_AGENT_INTENTS).nullable(),
  targetRole: z.string().trim().min(1).max(120).nullable(),
  seniority: z.enum(SENIORITY_LEVELS).nullable(),
  locations: stringArray,
  workModes: z.array(z.enum(WORK_MODE_VALUES)).max(3),
  industries: stringArray,
  companyPreferences: stringArray,
  companyTypes: z.array(z.enum(COMPANY_TYPE_VALUES)).max(5),
  technologies: stringArray,
  skills: stringArray,
  keywords: stringArray,
  salaryExpectation: z
    .object({
      min: z.number().int().min(0).nullable().default(null),
      max: z.number().int().min(0).nullable().default(null),
      currency: z.string().trim().max(10).nullable().default(null),
    })
    .nullable(),
  internationalPreference: z.boolean().nullable(),
  excludedRoles: stringArray,
  excludedIndustries: stringArray,
  excludedCompanies: stringArray,
  excludedWorkModes: z.array(z.enum(WORK_MODE_VALUES)).max(3),
  selectedJobId: z.string().nullable(),
  /** Real database job IDs from the last batch actually shown to the user, in display order — the only thing "second eka" is ever resolved against. */
  lastResultJobIds: z.array(z.string()).max(10),
  lastSearchAt: z.string().nullable(),
  missingInformation: stringArray,
};

export const CareerAgentStateSchema = z.object({
  intent: fieldShapes.intent.default(null),
  targetRole: fieldShapes.targetRole.default(null),
  seniority: fieldShapes.seniority.default(null),
  locations: fieldShapes.locations.default([]),
  workModes: fieldShapes.workModes.default([]),
  industries: fieldShapes.industries.default([]),
  companyPreferences: fieldShapes.companyPreferences.default([]),
  companyTypes: fieldShapes.companyTypes.default([]),
  technologies: fieldShapes.technologies.default([]),
  skills: fieldShapes.skills.default([]),
  keywords: fieldShapes.keywords.default([]),
  salaryExpectation: fieldShapes.salaryExpectation.default(null),
  internationalPreference: fieldShapes.internationalPreference.default(null),
  excludedRoles: fieldShapes.excludedRoles.default([]),
  excludedIndustries: fieldShapes.excludedIndustries.default([]),
  excludedCompanies: fieldShapes.excludedCompanies.default([]),
  excludedWorkModes: fieldShapes.excludedWorkModes.default([]),
  selectedJobId: fieldShapes.selectedJobId.default(null),
  lastResultJobIds: fieldShapes.lastResultJobIds.default([]),
  lastSearchAt: fieldShapes.lastSearchAt.default(null),
  missingInformation: fieldShapes.missingInformation.default([]),
});
export type CareerAgentState = z.infer<typeof CareerAgentStateSchema>;

export function emptyAgentState(): CareerAgentState {
  return CareerAgentStateSchema.parse({});
}

/**
 * What one Gemini extraction call returns — every persisted-state field
 * above, but genuinely OPTIONAL with no default (a key absent from
 * Gemini's JSON stays `undefined` after parsing, never silently
 * backfilled) — only fields the LATEST message actually touched should
 * be present (see prompts.ts). PLUS two transient, turn-only signals that
 * are never persisted as-is:
 *   - referencedResultIndex: a 1-indexed position ("second eka" -> 2)
 *     into lastResultJobIds — deterministic code resolves this to a real
 *     job ID (see resolve-reference.ts); Gemini never states an ID itself.
 *   - wantsMoreResults: "show more" / "thawa jobs" — triggers the next
 *     batch, excluding lastResultJobIds (see apply-filters.ts).
 */
export const StateUpdateSchema = z.object({
  intent: fieldShapes.intent.optional(),
  targetRole: fieldShapes.targetRole.optional(),
  seniority: fieldShapes.seniority.optional(),
  locations: fieldShapes.locations.optional(),
  workModes: fieldShapes.workModes.optional(),
  industries: fieldShapes.industries.optional(),
  companyPreferences: fieldShapes.companyPreferences.optional(),
  companyTypes: fieldShapes.companyTypes.optional(),
  technologies: fieldShapes.technologies.optional(),
  skills: fieldShapes.skills.optional(),
  keywords: fieldShapes.keywords.optional(),
  salaryExpectation: fieldShapes.salaryExpectation.optional(),
  internationalPreference: fieldShapes.internationalPreference.optional(),
  excludedRoles: fieldShapes.excludedRoles.optional(),
  excludedIndustries: fieldShapes.excludedIndustries.optional(),
  excludedCompanies: fieldShapes.excludedCompanies.optional(),
  excludedWorkModes: fieldShapes.excludedWorkModes.optional(),
  selectedJobId: fieldShapes.selectedJobId.optional(),
  lastResultJobIds: fieldShapes.lastResultJobIds.optional(),
  lastSearchAt: fieldShapes.lastSearchAt.optional(),
  missingInformation: fieldShapes.missingInformation.optional(),
  referencedResultIndex: z.number().int().min(1).max(10).nullable().default(null),
  wantsMoreResults: z.boolean().default(false),
});
export type StateUpdate = z.infer<typeof StateUpdateSchema>;
