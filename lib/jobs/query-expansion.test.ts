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
  it("returns just the role for a plain role search with no keywords/level", () => {
    const variants = expandSearchQueries(baseQuery());
    expect(variants).toEqual(["Data Science"]);
  });

  it("adds an internship-suffixed variant when level is internship and the role doesn't already say so", () => {
    const variants = expandSearchQueries(baseQuery({ level: "internship" }));
    expect(variants).toContain("Data Science");
    expect(variants).toContain("Data Science intern");
  });

  it("does not duplicate the internship variant if the role already mentions it", () => {
    const variants = expandSearchQueries(baseQuery({ role: "Data Science Internship", level: "internship" }));
    expect(variants).toEqual(["Data Science Internship"]);
  });

  // The real bug: the old implementation joined the role AND every
  // keyword into ONE combined string, which over-constrains a search
  // engine query. Confirm the role-alone variant exists as its own,
  // separate, broader query rather than always being combined with every skill.
  it("keeps the role alone as its own broad variant, separate from the role+skills variant", () => {
    const variants = expandSearchQueries(baseQuery({ keywords: ["Python", "Flutter", "Spring Boot"] }));
    expect(variants).toContain("Data Science");
    expect(variants.some((v) => v !== "Data Science" && v.startsWith("Data Science "))).toBe(true);
  });

  it("generates a standalone query for each of the top individual skills", () => {
    const variants = expandSearchQueries(baseQuery({ keywords: ["Python", "Flutter"] }));
    expect(variants).toContain("Python");
    expect(variants).toContain("Flutter");
  });

  it("suffixes individual skill variants with 'intern' too, when the search is internship-level", () => {
    const variants = expandSearchQueries(baseQuery({ level: "internship", keywords: ["Python"] }));
    expect(variants).toContain("Python intern");
  });

  it("caps individual skill variants at MAX_SKILL_VARIANTS worth, not one per keyword unboundedly", () => {
    const variants = expandSearchQueries(
      baseQuery({ keywords: ["Python", "Flutter", "Spring Boot", "SQL", "Power BI", "Machine Learning"] })
    );
    // role, role+intern-suffix (n/a, no level), role+top2, + at most 3 individual skills
    expect(variants.length).toBeLessThanOrEqual(MAX_QUERY_VARIANTS);
  });

  it("never exceeds MAX_QUERY_VARIANTS — controlled expansion, not an explosion", () => {
    const variants = expandSearchQueries(baseQuery({ level: "internship", keywords: ["ML", "AI", "Python"] }));
    expect(variants.length).toBeLessThanOrEqual(MAX_QUERY_VARIANTS);
  });

  it("falls back to the keywords alone when there's no role at all", () => {
    const variants = expandSearchQueries(baseQuery({ role: null, keywords: ["Python", "SQL"] }));
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every((v) => v.length > 0)).toBe(true);
  });

  it("returns nothing for an empty query — never searches on nothing", () => {
    expect(expandSearchQueries(baseQuery({ role: null, keywords: [] }))).toEqual([]);
  });

  it("never returns duplicate variants", () => {
    const variants = expandSearchQueries(baseQuery({ role: "Python", level: "internship", keywords: ["Python"] }));
    expect(new Set(variants).size).toBe(variants.length);
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
