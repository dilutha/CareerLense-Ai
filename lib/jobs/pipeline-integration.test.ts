import { describe, expect, it } from "vitest";
import { computeJobMatch, type MatchCandidateInput, type MatchJobInput } from "./match";
import { validateNormalizedJob } from "./normalize";
import { deduplicateJobs } from "./deduplicate";
import { findCanonicalDuplicate } from "./cross-source-dedupe";
import { rankJobs, selectChatResults } from "./rank";
import type { Job, JobMatch, JobWithMatch } from "./types";

/**
 * Integration-style test (PROJECT_SPEC's Phase 10A acceptance scenario):
 * a Sri Lankan undergraduate targeting a Data Analyst Internship, with
 * mocked ITPro + SerpApi results that include a genuine duplicate.
 * Composes the REAL production pipeline functions end to end
 * (validate -> same-batch dedupe -> cross-source dedupe -> deterministic
 * match -> rank -> top-N selection) with zero network/DB mocking needed,
 * since every one of these stages is a pure function — no real paid API
 * call, no Supabase, no Gemini involved anywhere in this test.
 */
describe("job discovery pipeline (integration)", () => {
  it("validates, dedupes within a batch by source+id, matches deterministically, and ranks the top results", () => {
    // Step 1: two providers' raw (already-normalized-shaped) results — a
    // genuine duplicate vacancy from two DIFFERENT sources, plus distinct jobs.
    const rawFromItpro = [
      {
        source: "itpro",
        sourceName: "ITPro.lk",
        sourceType: "job_board" as const,
        sourceJobId: "1001",
        title: "Data Analyst Intern",
        company: "ABC Analytics",
        location: null,
        country: "Sri Lanka",
        employmentType: "internship" as const,
        workMode: null,
        description: "Analyze retail data.",
        responsibilities: [],
        requirements: [],
        salaryText: null,
        postedAt: null,
        applicationUrl: "https://itpro.lk/job/1001/data-analyst-intern/",
        sourceUrl: "https://itpro.lk/job/1001/data-analyst-intern/",
      },
    ];

    const rawFromSerpApi = [
      {
        // Same real-world vacancy as the ITPro one above, found via a
        // different source — different application URL, different content_hash.
        source: "serpapi",
        sourceName: "Company Site",
        sourceType: "aggregator_result" as const,
        sourceJobId: "g-555",
        title: "Data Analyst Internship",
        company: "ABC Analytics (Pvt) Ltd",
        location: "Colombo",
        country: "Sri Lanka",
        employmentType: "internship" as const,
        workMode: null,
        description: "Analyze retail data for our Colombo team.",
        responsibilities: [],
        requirements: [],
        salaryText: null,
        postedAt: null,
        applicationUrl: "https://abcanalytics.com/careers/data-analyst-intern",
        sourceUrl: "https://abcanalytics.com/careers/data-analyst-intern",
      },
      {
        // A genuinely different vacancy — must never be merged.
        source: "serpapi",
        sourceName: "LinkedIn",
        sourceType: "aggregator_result" as const,
        sourceJobId: "g-777",
        title: "Machine Learning Intern",
        company: "XYZ Solutions",
        location: "Remote",
        country: "Sri Lanka",
        employmentType: "internship" as const,
        workMode: "remote" as const,
        description: "Build ML models.",
        responsibilities: [],
        requirements: [],
        salaryText: null,
        postedAt: null,
        applicationUrl: "https://www.linkedin.com/jobs/view/777",
        sourceUrl: "https://www.linkedin.com/jobs/view/777",
      },
    ];

    // Step 2: validate (as discovery.ts does for every provider result).
    const validated = [...rawFromItpro, ...rawFromSerpApi]
      .map(validateNormalizedJob)
      .filter((j) => j !== null);
    expect(validated).toHaveLength(3); // all 3 are well-formed

    // Step 3: same-batch dedup — these are from different sources with
    // different applicationUrls, so this stage correctly does NOT merge
    // them (that's cross-source-dedupe's job, run after storage).
    const deduped = deduplicateJobs(validated);
    expect(deduped).toHaveLength(3);

    // Step 4: cross-source dedup — simulates discovery.ts's
    // linkCrossSourceDuplicates, which runs AFTER the ITPro row is
    // already stored. The SerpApi "ABC Analytics" row should be
    // recognized as the same vacancy; the ML intern must not be.
    const storedItproJob: Job = {
      id: "existing-itpro-row",
      source: "itpro",
      source_name: "ITPro.lk",
      source_type: "job_board",
      source_job_id: "1001",
      title: "Data Analyst Intern",
      company_name: "ABC Analytics",
      location: "Colombo",
      country: "Sri Lanka",
      employment_type: "internship",
      work_mode: null,
      description: "Analyze retail data.",
      requirements: null,
      responsibilities: null,
      salary_text: null,
      application_url: "https://itpro.lk/job/1001/data-analyst-intern/",
      source_url: "https://itpro.lk/job/1001/data-analyst-intern/",
      posted_at: null,
      expires_at: null,
      is_active: true,
      raw_data: null,
      normalized_data: null,
      content_hash: "hash-itpro-1001",
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      listing_status: "active",
      duplicate_of: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const serpApiAbcJob = deduped.find((j) => j.source === "serpapi" && j.company === "ABC Analytics (Pvt) Ltd")!;
    const serpApiMlJob = deduped.find((j) => j.source === "serpapi" && j.company === "XYZ Solutions")!;

    const duplicateMatch = findCanonicalDuplicate(
      {
        source: serpApiAbcJob.source,
        title: serpApiAbcJob.title,
        company: serpApiAbcJob.company,
        location: serpApiAbcJob.location,
        applicationUrl: serpApiAbcJob.applicationUrl,
      },
      [storedItproJob]
    );
    expect(duplicateMatch?.id).toBe("existing-itpro-row"); // correctly identified as a duplicate

    const nonDuplicateMatch = findCanonicalDuplicate(
      {
        source: serpApiMlJob.source,
        title: serpApiMlJob.title,
        company: serpApiMlJob.company,
        location: serpApiMlJob.location,
        applicationUrl: serpApiMlJob.applicationUrl,
      },
      [storedItproJob]
    );
    expect(nonDuplicateMatch).toBeNull(); // genuinely different vacancy, never merged

    // Step 5: deterministic matching for a Sri Lankan Data Science
    // undergraduate — same candidate + same job must always produce the
    // same score (no Gemini involved in this computation at all).
    const candidate: MatchCandidateInput = {
      profileSkills: ["Python", "SQL", "Excel"],
      resumeSkills: ["Pandas"],
      targetRole: "Data Analyst",
      educationDegrees: ["BSc Data Science"],
      hasProfessionalExperience: false,
      projectCount: 2,
      preferredLocations: ["Colombo"],
      remotePreference: "any",
    };
    const jobInput: MatchJobInput = {
      title: "Data Analyst Intern",
      location: "Colombo",
      workMode: null,
      employmentType: "internship",
      requiredSkills: ["Python", "SQL"],
      preferredSkills: ["Power BI"],
      keywords: ["Python", "SQL", "Excel"],
      educationRequirements: ["Data Science"],
      experienceLevel: "internship",
    };

    const resultA = computeJobMatch(candidate, jobInput);
    const resultB = computeJobMatch(candidate, jobInput);
    expect(resultA.overall).toBe(resultB.overall); // reproducible
    expect(resultA.overall).toBeGreaterThan(0);
    expect(resultA.missingPreferredSkills).toContain("Power BI"); // honest gap, never hidden

    // Step 6: rank + top-N selection over a larger mock set proves the
    // "top 4-5, never dump everything" behavior end to end.
    const manyResults: JobWithMatch[] = Array.from({ length: 8 }, (_, i) => {
      const score = 95 - i * 8; // spread of scores, some above/below the 60 floor
      const match: JobMatch = {
        id: `match-${i}`,
        profile_id: "profile-1",
        job_id: `job-${i}`,
        resume_id: null,
        match_score: score,
        skills_score: score,
        role_score: score,
        experience_score: score,
        education_score: score,
        location_score: score,
        keyword_score: score,
        matched_skills: [],
        missing_required_skills: [],
        missing_preferred_skills: [],
        matched_keywords: [],
        missing_keywords: [],
        explanation: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return { job: { ...storedItproJob, id: `job-${i}` }, skills: [], match };
    });

    const ranked = rankJobs(manyResults);
    const { results: topResults } = selectChatResults(ranked);
    expect(topResults.length).toBeLessThanOrEqual(5); // never dumps everything
    expect(topResults.every((r) => (r.match?.match_score ?? 0) >= 60)).toBe(true); // quality floor respected
  });
});
