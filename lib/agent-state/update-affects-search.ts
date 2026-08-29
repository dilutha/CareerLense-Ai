import type { StateUpdate } from "./schema";

const SEARCH_RELEVANT_ARRAY_KEYS = [
  "locations",
  "workModes",
  "industries",
  "companyPreferences",
  "companyTypes",
  "technologies",
  "skills",
  "keywords",
  "excludedRoles",
  "excludedIndustries",
  "excludedCompanies",
  "excludedWorkModes",
] as const;

/**
 * True if this turn's extracted update actually changes something the
 * search/filter pipeline cares about — distinguishes a genuine refinement
 * ("international company ekak nam hodai") from a pure reference/
 * selection message ("second eka gana kiyanna", which only sets
 * referencedResultIndex) that should resolve against already-shown
 * results instead of triggering a brand-new search (Part 21).
 */
export function updateAffectsSearch(update: StateUpdate): boolean {
  if (update.wantsMoreResults) return true;
  if (update.targetRole !== undefined) return true;
  if (update.seniority !== undefined) return true;
  if (update.salaryExpectation !== undefined) return true;
  if (update.internationalPreference !== undefined) return true;

  for (const key of SEARCH_RELEVANT_ARRAY_KEYS) {
    // Presence, not non-emptiness — the extraction step returns an
    // explicit [] when the user clears a constraint (Part 16: "Colombo
    // only" -> "anywhere in Sri Lanka" broadens the search, it doesn't
    // become a no-op). A key genuinely absent from the update (undefined)
    // is the only case that means "this message didn't touch it."
    if (update[key] !== undefined) return true;
  }

  return false;
}
