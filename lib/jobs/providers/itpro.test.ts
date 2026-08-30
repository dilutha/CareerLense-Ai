import { describe, expect, it } from "vitest";
import { inferEmploymentType, inferWorkMode, matchesQuery, toNormalizedJob, type ItProJob } from "./itpro";
import type { JobSearchQuery } from "./types";

const baseRaw: ItProJob = {
  id: "14792",
  title: "Motion Graphic Designer / Video Editor",
  description: "<p>Great <strong>role</strong> with <ul><li>benefits</li></ul></p>",
  summary: "Join Innobot Health as a Motion Graphic Designer in Colombo, Full-time. Apply now on ITPro.lk.",
  type_id: "1",
  category_id: "27",
  location: "79",
  company: "Innobot Health",
  website: "https://innobothealth.com",
  views_count: "38",
  created_on: "2026-08-28 11:48:20",
};

describe("itpro toNormalizedJob", () => {
  it("normalizes a real-shaped API response", () => {
    const job = toNormalizedJob(baseRaw);
    expect(job).not.toBeNull();
    expect(job?.source).toBe("itpro");
    expect(job?.sourceJobId).toBe("14792");
    expect(job?.title).toBe(baseRaw.title);
    expect(job?.company).toBe("Innobot Health");
    // Numeric location code has no public mapping — never guessed.
    expect(job?.location).toBeNull();
    expect(job?.applicationUrl).toMatch(/^https:\/\/itpro\.lk\/job\/14792\//);
    expect(job?.sourceUrl).toBe(job?.applicationUrl);
  });

  it("strips HTML from the description", () => {
    const job = toNormalizedJob(baseRaw);
    expect(job?.description).not.toContain("<p>");
    expect(job?.description).not.toContain("<strong>");
    expect(job?.description).toContain("Great");
    expect(job?.description).toContain("benefits");
  });

  it("infers employment type only from literal keywords in the source's own text, never guesses", () => {
    expect(inferEmploymentType("Full-time role in Colombo")).toBe("full_time");
    expect(inferEmploymentType("This is an Internship opportunity")).toBe("internship");
    expect(inferEmploymentType("Nothing about hours here")).toBeNull();
  });

  it("infers work mode only from literal keywords", () => {
    expect(inferWorkMode("100% Remote position")).toBe("remote");
    expect(inferWorkMode("Hybrid work available")).toBe("hybrid");
    expect(inferWorkMode("No mode mentioned")).toBeNull();
  });

  it("rejects a malformed API response missing required fields", () => {
    const malformed = { ...baseRaw, id: "", title: "" } as ItProJob;
    expect(toNormalizedJob(malformed)).toBeNull();
  });

  it("rejects a response with a completely missing title", () => {
    const rest: Partial<ItProJob> = { ...baseRaw };
    delete rest.title;
    const malformed = rest as unknown as ItProJob;
    expect(toNormalizedJob(malformed)).toBeNull();
  });

  it("never invents a company name when the API doesn't provide one", () => {
    const job = toNormalizedJob({ ...baseRaw, company: null });
    expect(job?.company).toBeNull();
  });
});

describe("itpro matchesQuery", () => {
  const query = (overrides: Partial<JobSearchQuery>): JobSearchQuery => ({
    role: null,
    location: null,
    country: "Sri Lanka",
    level: null,
    workMode: null,
    keywords: [],
    limit: 20,
    ...overrides,
  });

  const job = toNormalizedJob({
    ...baseRaw,
    title: "Data Analyst Intern",
    description: "<p>Work with dashboards and reporting tools. Strong analytical mindset required.</p>",
  })!;

  it("keeps a job whose title matches the role even when no keyword literally appears in the text", () => {
    // Regression test: a prior version required an exact keyword substring
    // match (e.g. "power bi") in addition to the role match, which silently
    // dropped real listings that phrase a skill differently or just don't
    // restate it — see the comment on matchesQuery in itpro.ts.
    const result = matchesQuery(job, query({ role: "data analyst", keywords: ["power bi", "sql"] }));
    expect(result).toBe(true);
  });

  it("rejects a job whose title/description share no token with the role at all", () => {
    const result = matchesQuery(job, query({ role: "network security engineer", keywords: [] }));
    expect(result).toBe(false);
  });

  it("keeps everything when no role is specified", () => {
    const result = matchesQuery(job, query({ role: null, keywords: ["irrelevant"] }));
    expect(result).toBe(true);
  });
});
