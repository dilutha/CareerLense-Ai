import { describe, expect, it } from "vitest";
import { expandDomainVariants, expandSearchQueries, MAX_QUERY_VARIANTS, resolveSearchLocation } from "./query-expansion";
import type { JobSearchQuery } from "./providers/types";

// "Backend Developer" is deliberately a SPECIFIC, non-broad title (doesn't
// match any domain-expansion trigger or umbrella pattern) so these tests
// exercise the plain mechanical expansion in isolation, unconfounded by the
// separate domain-broadening behavior covered in its own describe block below.
function baseQuery(overrides: Partial<JobSearchQuery> = {}): JobSearchQuery {
  return {
    role: "Backend Developer",
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
  it("returns just the role for a plain, specific role search with no keywords/level", () => {
    const variants = expandSearchQueries(baseQuery());
    expect(variants).toEqual(["Backend Developer"]);
  });

  it("adds an internship-suffixed variant when level is internship and the role doesn't already say so", () => {
    const variants = expandSearchQueries(baseQuery({ level: "internship" }));
    expect(variants).toContain("Backend Developer");
    expect(variants).toContain("Backend Developer intern");
  });

  it("does not duplicate the internship variant if the role already mentions it", () => {
    const variants = expandSearchQueries(baseQuery({ role: "Backend Developer Internship", level: "internship" }));
    expect(variants).toEqual(["Backend Developer Internship"]);
  });

  // The real bug: the old implementation joined the role AND every
  // keyword into ONE combined string, which over-constrains a search
  // engine query. Confirm the role-alone variant exists as its own,
  // separate, broader query rather than always being combined with every skill.
  it("keeps the role alone as its own broad variant, separate from the role+skills variant", () => {
    const variants = expandSearchQueries(baseQuery({ keywords: ["Python", "Flutter", "Spring Boot"] }));
    expect(variants).toContain("Backend Developer");
    expect(variants.some((v) => v !== "Backend Developer" && v.startsWith("Backend Developer "))).toBe(true);
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
      baseQuery({ keywords: ["Python", "Flutter", "Spring Boot", "SQL", "Power BI", "Elixir"] })
    );
    // role, role+intern-suffix (n/a, no level), role+top2, + at most 3 individual skills
    expect(variants.length).toBeLessThanOrEqual(MAX_QUERY_VARIANTS);
  });

  it("never exceeds MAX_QUERY_VARIANTS — controlled expansion, not an explosion", () => {
    const variants = expandSearchQueries(baseQuery({ level: "internship", keywords: ["Go", "Rust", "Elixir"] }));
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

// Regression coverage for the "AI/ML/Data Science internship" complaint:
// a broad/compound role phrase must expand into the real, postable titles
// real listings actually use, not just mechanically suffix the literal
// (often nonsensical-as-a-search-string) input text.
describe("expandDomainVariants", () => {
  it("expands a bare umbrella term into real sibling titles", () => {
    const variants = expandDomainVariants("AI", false);
    expect(variants).toEqual(expect.arrayContaining(["AI", "Machine Learning", "Data Science", "Data Analyst"]));
  });

  it("expands a compound/slash-separated role into the same family", () => {
    const variants = expandDomainVariants("AI/ML/Data Science", true);
    expect(variants).toEqual(
      expect.arrayContaining(["AI intern", "Machine Learning intern", "Data Science intern", "Data Analyst intern"])
    );
  });

  it("does NOT broaden an already-specific title, even one that mentions a domain word", () => {
    // "Data Analyst" is itself one of the sibling titles above — real and
    // precise on its own. A user who explicitly asked for it shouldn't have
    // their search diluted back out to AI/ML/Data-Science-at-large.
    expect(expandDomainVariants("Data Analyst", false)).toEqual([]);
    expect(expandDomainVariants("Backend Developer", false)).toEqual([]);
  });

  it("returns nothing for a null role", () => {
    expect(expandDomainVariants(null, false)).toEqual([]);
  });

  it("expandSearchQueries puts domain variants first, ahead of the raw compound role text", () => {
    const variants = expandSearchQueries({
      role: "AI/ML/Data Science Intern",
      location: null,
      country: "Sri Lanka",
      level: "internship",
      workMode: null,
      keywords: [],
      limit: 20,
    });
    expect(variants[0]).not.toBe("AI/ML/Data Science Intern");
    expect(variants).toEqual(expect.arrayContaining(["AI intern", "Machine Learning intern", "Data Science intern", "Data Analyst intern"]));
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
