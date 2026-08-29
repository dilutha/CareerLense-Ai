import { describe, expect, it } from "vitest";
import { computeAnalyticsSummary } from "./analytics-summary";
import { findRoleFamily } from "@/lib/jobs/role-taxonomy";
import type { Job, JobMatch } from "@/lib/jobs/types";

function makeJob(id: string, title: string): Job {
  return {
    id,
    source: "itpro",
    source_name: "ITPro.lk",
    source_type: "job_board",
    source_job_id: null,
    title,
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

function makeMatch(jobId: string, score: number, missing: string[] = []): JobMatch {
  return {
    id: `m-${jobId}`,
    profile_id: "p1",
    job_id: jobId,
    resume_id: null,
    match_score: score,
    skills_score: null,
    role_score: null,
    experience_score: null,
    education_score: null,
    location_score: null,
    keyword_score: null,
    matched_skills: [],
    missing_required_skills: missing,
    missing_preferred_skills: [],
    matched_keywords: [],
    missing_keywords: [],
    explanation: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("computeAnalyticsSummary", () => {
  it("returns all-null summary for zero jobs — never NaN or 'Unknown'", () => {
    const summary = computeAnalyticsSummary([], new Map());
    expect(summary.averageMatchScore).toBeNull();
    expect(summary.topAppliedRole).toBeNull();
    expect(summary.topSkillGap).toBeNull();
  });

  it("computes a correct average match score", () => {
    const jobs = [makeJob("j1", "Data Analyst"), makeJob("j2", "Data Analyst")];
    const matches = new Map([
      ["j1", makeMatch("j1", 80)],
      ["j2", makeMatch("j2", 90)],
    ]);
    const summary = computeAnalyticsSummary(jobs, matches);
    expect(summary.averageMatchScore).toBe(85);
  });

  it("finds the most frequent role family as topAppliedRole", () => {
    const jobs = [makeJob("j1", "Data Analyst"), makeJob("j2", "Data Analyst"), makeJob("j3", "Software Engineer")];
    const summary = computeAnalyticsSummary(jobs, new Map());
    // findRoleFamily returns its own normalized family label, not the raw title verbatim.
    expect(summary.topAppliedRole).toBe(findRoleFamily("Data Analyst"));
  });

  it("finds the most frequent missing skill as topSkillGap", () => {
    const jobs = [makeJob("j1", "Data Analyst"), makeJob("j2", "Data Analyst")];
    const matches = new Map([
      ["j1", makeMatch("j1", 80, ["SQL", "Python"])],
      ["j2", makeMatch("j2", 70, ["SQL"])],
    ]);
    const summary = computeAnalyticsSummary(jobs, matches);
    expect(summary.topSkillGap).toBe("SQL");
  });
});
