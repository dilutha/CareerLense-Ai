import { describe, expect, it } from "vitest";
import { applyConversationalFilters } from "./apply-filters";
import { emptyAgentState } from "./schema";
import type { Job, JobWithMatch } from "@/lib/jobs/types";

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: "j1",
    source: "itpro",
    source_name: "ITPro.lk",
    source_type: "job_board",
    source_job_id: null,
    title: "Data Analyst Intern",
    company_name: "Acme Corp",
    location: "Colombo",
    country: "Sri Lanka",
    employment_type: "internship",
    work_mode: "hybrid",
    description: null,
    requirements: null,
    responsibilities: null,
    salary_text: null,
    application_url: "https://example.com",
    source_url: null,
    posted_at: null,
    expires_at: null,
    is_active: true,
    raw_data: null,
    normalized_data: null,
    content_hash: "h",
    first_seen_at: "",
    last_seen_at: "",
    listing_status: "active",
    duplicate_of: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeItem(overrides: Partial<Job>): JobWithMatch {
  return { job: makeJob(overrides), skills: [], match: null };
}

describe("applyConversationalFilters", () => {
  it("passes everything through when the state has no exclusions", () => {
    const items = [makeItem({ id: "j1" }), makeItem({ id: "j2" })];
    expect(applyConversationalFilters(items, emptyAgentState())).toHaveLength(2);
  });

  it("excludes a job whose title matches an excluded role (e.g. 'call center jobs epa')", () => {
    const items = [
      makeItem({ id: "j1", title: "Call Center Agent" }),
      makeItem({ id: "j2", title: "Data Analyst Intern" }),
    ];
    const state = { ...emptyAgentState(), excludedRoles: ["call center"] };
    const result = applyConversationalFilters(items, state);
    expect(result.map((r) => r.job.id)).toEqual(["j2"]);
  });

  it("excludes a job from an excluded company", () => {
    const items = [
      makeItem({ id: "j1", company_name: "Bad Corp" }),
      makeItem({ id: "j2", company_name: "Good Corp" }),
    ];
    const state = { ...emptyAgentState(), excludedCompanies: ["Bad Corp"] };
    const result = applyConversationalFilters(items, state);
    expect(result.map((r) => r.job.id)).toEqual(["j2"]);
  });

  it("excludes a job by work mode", () => {
    const items = [
      makeItem({ id: "j1", work_mode: "onsite" }),
      makeItem({ id: "j2", work_mode: "remote" }),
    ];
    const state = { ...emptyAgentState(), excludedWorkModes: ["onsite" as const] };
    const result = applyConversationalFilters(items, state);
    expect(result.map((r) => r.job.id)).toEqual(["j2"]);
  });

  it("dedupes already-shown results for 'show more' via excludeJobIds", () => {
    const items = [makeItem({ id: "j1" }), makeItem({ id: "j2" }), makeItem({ id: "j3" })];
    const result = applyConversationalFilters(items, emptyAgentState(), ["j1", "j2"]);
    expect(result.map((r) => r.job.id)).toEqual(["j3"]);
  });

  it("never filters out a job that matches nothing excluded", () => {
    const items = [makeItem({ id: "j1", title: "Data Analyst", company_name: "Acme", work_mode: "hybrid" })];
    const state = { ...emptyAgentState(), excludedRoles: ["sales"], excludedCompanies: ["OtherCorp"] };
    expect(applyConversationalFilters(items, state)).toHaveLength(1);
  });
});
