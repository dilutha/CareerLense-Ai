import { describe, expect, it } from "vitest";
import { updateAffectsSearch } from "./update-affects-search";
import { StateUpdateSchema } from "./schema";

function update(partial: object) {
  return StateUpdateSchema.parse(partial);
}

describe("updateAffectsSearch", () => {
  it("is false for a completely empty update", () => {
    expect(updateAffectsSearch(update({}))).toBe(false);
  });

  it("is false for an update that only sets referencedResultIndex ('second eka gana kiyanna')", () => {
    expect(updateAffectsSearch(update({ referencedResultIndex: 2 }))).toBe(false);
  });

  it("is true when targetRole is set", () => {
    expect(updateAffectsSearch(update({ targetRole: "Data Analyst" }))).toBe(true);
  });

  it("is true when wantsMoreResults is set", () => {
    expect(updateAffectsSearch(update({ wantsMoreResults: true }))).toBe(true);
  });

  it("is true when a non-empty preference array is set", () => {
    expect(updateAffectsSearch(update({ locations: ["Colombo"] }))).toBe(true);
    expect(updateAffectsSearch(update({ excludedRoles: ["sales"] }))).toBe(true);
  });

  it("is true when an array field is explicitly cleared to [] — e.g. 'Colombo only' -> 'anywhere in Sri Lanka' broadens the search, it isn't a no-op", () => {
    expect(updateAffectsSearch(update({ locations: [] }))).toBe(true);
  });

  it("is true when internationalPreference is explicitly set", () => {
    expect(updateAffectsSearch(update({ internationalPreference: true }))).toBe(true);
  });
});
