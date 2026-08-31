import { describe, expect, it } from "vitest";
import { deduplicateJobs } from "./deduplicate";
import type { NormalizedJob } from "./schemas";

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "serpapi",
    sourceName: "Test Board",
    sourceType: "aggregator_result",
    sourceJobId: null,
    title: "Software Engineer Intern",
    company: "Acme",
    location: "Colombo",
    country: "Sri Lanka",
    employmentType: "internship",
    workMode: null,
    description: null,
    responsibilities: [],
    requirements: [],
    salaryText: null,
    postedAt: null,
    applicationUrl: "https://example.com/jobs/123",
    sourceUrl: "https://example.com/jobs/123",
    ...overrides,
  };
}

describe("deduplicateJobs", () => {
  it("drops a same-content duplicate returned under a DIFFERENT sourceJobId — the real bug found live", () => {
    // SerpAPI's tiered multi-query dispatch can return the exact same
    // real posting (same source/title/company/location/applicationUrl,
    // so the same content_hash) with a different per-query job_id. If
    // both survived, the database upsert (keyed on content_hash) would
    // reject the whole batch — this must never happen.
    const jobs = [
      makeJob({ sourceJobId: "query-variant-A-id-1" }),
      makeJob({ sourceJobId: "query-variant-B-id-2" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
  });

  it("drops a same-sourceJobId duplicate even if some other field drifted slightly", () => {
    const jobs = [
      makeJob({ sourceJobId: "itpro-42", description: "Original text" }),
      makeJob({ sourceJobId: "itpro-42", description: "Slightly re-scraped text" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
  });

  it("keeps two genuinely different jobs from different companies with the same title", () => {
    const jobs = [
      makeJob({ company: "Acme", applicationUrl: "https://acme.example/jobs/1", sourceUrl: "https://acme.example/jobs/1" }),
      makeJob({ company: "Globex", applicationUrl: "https://globex.example/jobs/1", sourceUrl: "https://globex.example/jobs/1" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(2);
  });

  it("keeps two genuinely different jobs from the same provider with no sourceJobId at all, relying on content hash", () => {
    const jobs = [
      makeJob({ title: "Data Analyst Intern", applicationUrl: "https://example.com/jobs/1" }),
      makeJob({ title: "Machine Learning Intern", applicationUrl: "https://example.com/jobs/2" }),
    ];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(2);
  });

  it("dedupes an exact repeat with no sourceJobId at all (falls back to content hash alone)", () => {
    const jobs = [makeJob(), makeJob()];
    const result = deduplicateJobs(jobs);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array for an empty input", () => {
    expect(deduplicateJobs([])).toEqual([]);
  });

  it("preserves first-seen order", () => {
    const jobs = [
      makeJob({ title: "A", applicationUrl: "https://example.com/a" }),
      makeJob({ title: "B", applicationUrl: "https://example.com/b" }),
      makeJob({ title: "A", applicationUrl: "https://example.com/a" }), // duplicate of the first
    ];
    const result = deduplicateJobs(jobs);
    expect(result.map((j) => j.title)).toEqual(["A", "B"]);
  });
});
