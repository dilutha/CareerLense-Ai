import { describe, expect, it } from "vitest";
import { rankJobs, selectChatResults } from "./rank";
import type { Job, JobMatch, JobWithMatch } from "./types";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function makeItem(id: string, matchScore: number, postedDaysAgo: number | null): JobWithMatch {
  const job: Job = {
    id,
    source: "itpro",
    source_name: "ITPro.lk",
    source_type: "job_board",
    source_job_id: id,
    title: `Job ${id}`,
    company_name: "Acme",
    location: "Colombo",
    country: "Sri Lanka",
    employment_type: "internship",
    work_mode: null,
    description: null,
    requirements: null,
    responsibilities: null,
    salary_text: null,
    application_url: `https://itpro.lk/job/${id}/`,
    source_url: `https://itpro.lk/job/${id}/`,
    posted_at: postedDaysAgo === null ? null : daysAgo(postedDaysAgo),
    expires_at: null,
    is_active: true,
    raw_data: null,
    normalized_data: null,
    content_hash: `hash-${id}`,
    first_seen_at: postedDaysAgo === null ? new Date().toISOString() : daysAgo(postedDaysAgo),
    last_seen_at: new Date().toISOString(),
    listing_status: "active",
    duplicate_of: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const match: JobMatch = {
    id: `match-${id}`,
    profile_id: "profile-1",
    job_id: id,
    resume_id: null,
    match_score: matchScore,
    skills_score: matchScore,
    role_score: matchScore,
    experience_score: matchScore,
    education_score: matchScore,
    location_score: matchScore,
    keyword_score: matchScore,
    matched_skills: [],
    missing_required_skills: [],
    missing_preferred_skills: [],
    matched_keywords: [],
    missing_keywords: [],
    explanation: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return { job, skills: [], match };
}

describe("rankJobs", () => {
  it("ranks primarily by match score", () => {
    const items = [makeItem("a", 60, 5), makeItem("b", 95, 20), makeItem("c", 80, 5)];
    const ranked = rankJobs(items);
    expect(ranked.map((r) => r.job.id)).toEqual(["b", "c", "a"]);
  });

  it("never lets freshness flip a large match-score gap (95% older beats 65% fresh)", () => {
    const older = makeItem("strong-old", 95, 30);
    const fresh = makeItem("weak-fresh", 65, 0);
    const ranked = rankJobs([fresh, older]);
    expect(ranked[0].job.id).toBe("strong-old");
  });

  it("uses freshness to break a near-tie", () => {
    const fresher = makeItem("fresher", 80, 0);
    const older = makeItem("older", 80, 30);
    const ranked = rankJobs([older, fresher]);
    expect(ranked[0].job.id).toBe("fresher");
  });
});

describe("selectChatResults", () => {
  it("picks up to 5 results that clear the quality floor, never padding with weak ones", () => {
    const items = [
      makeItem("a", 95, 1),
      makeItem("b", 88, 1),
      makeItem("c", 70, 1),
      makeItem("d", 40, 1), // below floor
      makeItem("e", 20, 1), // below floor
    ];
    const { results, belowQualityBar } = selectChatResults(items);
    expect(results.map((r) => r.job.id)).toEqual(["a", "b", "c"]);
    expect(belowQualityBar).toBe(false);
  });

  it("shows only 3 when only 3 genuinely strong jobs exist, not manufactured 5", () => {
    const items = [makeItem("a", 95, 1), makeItem("b", 85, 1), makeItem("c", 65, 1)];
    const { results, belowQualityBar } = selectChatResults(rankJobs(items));
    expect(results.length).toBe(3);
    expect(belowQualityBar).toBe(false);
  });

  it("caps at 5 even when more than 5 clear the floor", () => {
    const items = Array.from({ length: 8 }, (_, i) => makeItem(`j${i}`, 90 - i, 1));
    const { results } = selectChatResults(rankJobs(items));
    expect(results.length).toBe(5);
  });

  it("falls back to the best few (honestly flagged) when almost nothing clears the floor", () => {
    const items = [makeItem("a", 40, 1), makeItem("b", 30, 1)];
    const { results, belowQualityBar } = selectChatResults(items);
    expect(results.length).toBeGreaterThan(0);
    expect(belowQualityBar).toBe(true);
  });

  it("returns nothing, honestly, when there are no results at all", () => {
    const { results, belowQualityBar } = selectChatResults([]);
    expect(results).toEqual([]);
    expect(belowQualityBar).toBe(false);
  });
});
