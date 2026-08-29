import { describe, expect, it } from "vitest";
import { expandSearchQueries, MAX_QUERY_VARIANTS, resolveSearchLocation } from "./query-expansion";
import type { JobSearchQuery } from "./providers/types";

function baseQuery(overrides: Partial<JobSearchQuery> = {}): JobSearchQuery {
  return {
    role: "Data Science",
    location: null,
    country: "Sri Lanka",
    level: null,
    workMode: null,
    keywords: [],
    limit: 20,
    ...overrides,
  };
}

describe("expandSearchQueries", () => {
  it("returns a single variant for a plain role search", () => {
    const variants = expandSearchQueries(baseQuery());
    expect(variants).toEqual(["Data Science"]);
  });

  it("adds one internship-specific variant when level is internship and the role doesn't already say so", () => {
    const variants = expandSearchQueries(baseQuery({ level: "internship" }));
    expect(variants).toContain("Data Science");
    expect(variants).toContain("Data Science internship");
    expect(variants.length).toBeLessThanOrEqual(MAX_QUERY_VARIANTS);
  });

  it("does not duplicate the internship variant if the role already mentions it", () => {
    const variants = expandSearchQueries(baseQuery({ role: "Data Science Internship", level: "internship" }));
    expect(variants).toEqual(["Data Science Internship"]);
  });

  it("never exceeds MAX_QUERY_VARIANTS — controlled expansion, not an explosion", () => {
    const variants = expandSearchQueries(baseQuery({ level: "internship", keywords: ["ML", "AI", "Python"] }));
    expect(variants.length).toBeLessThanOrEqual(MAX_QUERY_VARIANTS);
  });

  it("returns nothing for an empty query — never searches on nothing", () => {
    expect(expandSearchQueries(baseQuery({ role: null, keywords: [] }))).toEqual([]);
  });
});

describe("resolveSearchLocation", () => {
  it("combines location + country when both are given", () => {
    expect(resolveSearchLocation(baseQuery({ location: "Colombo" }))).toBe("Colombo, Sri Lanka");
  });

  it("falls back to country alone when no city is given", () => {
    expect(resolveSearchLocation(baseQuery({ location: null }))).toBe("Sri Lanka");
  });

  it("returns null for a remote-only search with no explicit location — avoids over-filtering", () => {
    expect(resolveSearchLocation(baseQuery({ workMode: "remote", location: null }))).toBeNull();
  });

  it("still honors an explicit location even for a remote search", () => {
    expect(resolveSearchLocation(baseQuery({ workMode: "remote", location: "Colombo" }))).toBe(
      "Colombo, Sri Lanka"
    );
  });
});
