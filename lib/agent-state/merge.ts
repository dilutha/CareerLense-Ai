import type { CareerAgentState, StateUpdate } from "./schema";

/** Fields of StateUpdate that persist into CareerAgentState — excludes the two transient, turn-only signals. */
const PERSISTED_KEYS = [
  "intent",
  "targetRole",
  "seniority",
  "locations",
  "workModes",
  "industries",
  "companyPreferences",
  "companyTypes",
  "technologies",
  "skills",
  "keywords",
  "salaryExpectation",
  "internationalPreference",
  "excludedRoles",
  "excludedIndustries",
  "excludedCompanies",
  "excludedWorkModes",
  "selectedJobId",
  "lastResultJobIds",
  "lastSearchAt",
  "missingInformation",
] as const satisfies readonly (keyof CareerAgentState)[];

/**
 * Applies one turn's extracted update onto the current persisted state.
 *
 * Deliberately a whole-field REPLACE for any key present in `update`, not
 * a deep/array merge — natural-language "add vs. replace" intent can't be
 * inferred mechanically (Part 16's own examples prove this: "actually
 * hybrid is okay" should ADD to workModes, while "anywhere in Sri Lanka"
 * should REPLACE locations — both are just "a value present in the
 * update"). That reasoning happens once, in the extraction prompt (which
 * already has the CURRENT state in its context and can decide whether the
 * user is adding or replacing) — extractStateUpdate returns the complete
 * intended value for any field it touches, and this function's job is
 * only to apply it. A key absent from `update` (undefined) always leaves
 * the current value untouched.
 */
export function mergeAgentState(current: CareerAgentState, update: Partial<StateUpdate>): CareerAgentState {
  const next = { ...current };
  for (const key of PERSISTED_KEYS) {
    const value = update[key];
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next as any)[key] = value;
    }
  }
  return next;
}
