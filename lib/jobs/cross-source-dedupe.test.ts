import { describe, expect, it } from "vitest";
import { findCanonicalDuplicate, type DuplicateCandidate } from "./cross-source-dedupe";
import type { Job } from "./types";

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: "existing-1",
    source: "itpro",
    source_name: "ITPro.lk",
    source_type: "job_board",
    source_job_id: "1",
    title: "Data Science Intern",
    company_name: "ABC Pvt Ltd",
    location: "Colombo",
    country: "Sri Lanka",
    employment_type: "internship",
    work_mode: null,
    description: null,
    requirements: null,
    responsibilities: null,
    salary_text: null,
    application_url: "https://itpro.lk/job/1/data-science-intern/",
    source_url: "https://itpro.lk/job/1/data-science-intern/",
    posted_at: null,
    expires_at: null,
    is_active: true,
    raw_data: null,
    normalized_data: null,
    content_hash: "hash-1",
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    listing_status: "active",
    duplicate_of: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("findCanonicalDuplicate", () => {
  it("matches on identical company + title + location across different sources", () => {
    const existing = [makeJob({})];
    const candidate: DuplicateCandidate = {
      source: "company-careers",
      title: "Data Science Internship",
      company: "ABC (Pvt) Ltd",
      location: "Colombo",
      applicationUrl: "https://abc.com/careers/data-science-intern",
    };
    expect(findCanonicalDuplicate(candidate, existing)?.id).toBe("existing-1");
  });

  it("matches on an exact application URL regardless of company/title wording", () => {
    const existing = [makeJob({ application_url: "https://abc.com/careers/ds-intern" })];
    const candidate: DuplicateCandidate = {
      source: "company-careers",
      title: "Completely Different Title Text",
      company: "Some Other Name",
      location: null,
      applicationUrl: "https://abc.com/careers/ds-intern",
    };
    expect(findCanonicalDuplicate(candidate, existing)?.id).toBe("existing-1");
  });

  it("does NOT merge two different companies hiring for the same title", () => {
    const existing = [makeJob({ company_name: "ABC Pvt Ltd" })];
    const candidate: DuplicateCandidate = {
      source: "company-careers",
      title: "Data Science Intern",
      company: "XYZ Solutions",
      location: "Colombo",
      applicationUrl: "https://xyz.com/careers/ds-intern",
    };
    expect(findCanonicalDuplicate(candidate, existing)).toBeNull();
  });

  it("does NOT merge the same company's genuinely different roles", () => {
    const existing = [makeJob({ title: "Data Science Intern" })];
    const candidate: DuplicateCandidate = {
      source: "company-careers",
      title: "Marketing Intern",
      company: "ABC Pvt Ltd",
      location: "Colombo",
      applicationUrl: "https://abc.com/careers/marketing-intern",
    };
    expect(findCanonicalDuplicate(candidate, existing)).toBeNull();
  });

  it("never compares a job against another row from the same source", () => {
    const existing = [makeJob({ source: "itpro" })];
    const candidate: DuplicateCandidate = {
      source: "itpro",
      title: "Data Science Intern",
      company: "ABC Pvt Ltd",
      location: "Colombo",
      applicationUrl: "https://itpro.lk/job/1/data-science-intern/",
    };
    expect(findCanonicalDuplicate(candidate, existing)).toBeNull();
  });

  it("does not merge when company or title is missing on the candidate", () => {
    const existing = [makeJob({})];
    const candidate: DuplicateCandidate = {
      source: "company-careers",
      title: "Data Science Intern",
      company: null,
      location: "Colombo",
      applicationUrl: "https://different.com/job",
    };
    expect(findCanonicalDuplicate(candidate, existing)).toBeNull();
  });
});
