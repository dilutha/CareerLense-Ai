import { describe, expect, it } from "vitest";
import { computeSourcePerformance } from "./source-performance";
import type { ApplicationRow } from "./types";
import type { Job } from "@/lib/jobs/types";

function makeJob(id: string, sourceType: Job["source_type"]): Job {
  return {
    id,
    source: "itpro",
    source_name: "ITPro.lk",
    source_type: sourceType,
    source_job_id: null,
    title: "Data Analyst",
    company_name: "Acme",
    location: "Colombo",
    country: "LK",
    employment_type: "full_time",
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
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    listing_status: "active",
    duplicate_of: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeApp(id: string, jobId: string, status: ApplicationRow["status"]): ApplicationRow {
  return {
    id,
    profile_id: "p1",
    job_id: jobId,
    application_document_id: null,
    status,
    notes: null,
    follow_up_date: null,
    interview_at: null,
    applied_at: null,
    last_status_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("computeSourcePerformance", () => {
  it("returns an empty array for zero applications", () => {
    expect(computeSourcePerformance([], new Map())).toEqual([]);
  });

  it("groups by job.source_type and counts interviews correctly", () => {
    const jobsById = new Map([
      ["j1", makeJob("j1", "job_board")],
      ["j2", makeJob("j2", "aggregator_result")],
      ["j3", makeJob("j3", "job_board")],
    ]);
    const apps = [
      makeApp("a1", "j1", "applied"),
      makeApp("a2", "j2", "interview"),
      makeApp("a3", "j3", "interview"),
    ];
    const result = computeSourcePerformance(apps, jobsById);
    const jobBoard = result.find((r) => r.sourceType === "job_board")!;
    const aggregator = result.find((r) => r.sourceType === "aggregator_result")!;
    expect(jobBoard.applications).toBe(2);
    expect(jobBoard.interviews).toBe(1);
    expect(aggregator.applications).toBe(1);
    expect(aggregator.interviews).toBe(1);
  });

  it("skips applications whose job can't be found rather than crashing", () => {
    const apps = [makeApp("a1", "missing-job", "applied")];
    expect(computeSourcePerformance(apps, new Map())).toEqual([]);
  });
});
