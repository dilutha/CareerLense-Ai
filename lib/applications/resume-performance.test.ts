import { describe, expect, it } from "vitest";
import { computeResumePerformance } from "./resume-performance";
import type { ApplicationRow } from "./types";

function makeApp(id: string, docId: string | null, status: ApplicationRow["status"]): ApplicationRow {
  return {
    id,
    profile_id: "p1",
    job_id: "j1",
    application_document_id: docId,
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

describe("computeResumePerformance", () => {
  it("returns no entries and no observation for zero applications", () => {
    const result = computeResumePerformance([], new Map(), new Map());
    expect(result.entries).toEqual([]);
    expect(result.observation).toBeNull();
  });

  it("ignores applications with no linked document — never crashes", () => {
    const apps = [makeApp("a1", null, "applied")];
    const result = computeResumePerformance(apps, new Map(), new Map());
    expect(result.entries).toEqual([]);
  });

  it("groups by the ORIGINAL resume id (not per-job tailored version)", () => {
    const apps = [
      makeApp("a1", "doc1", "applied"),
      makeApp("a2", "doc2", "interview"),
    ];
    const documentToResumeId = new Map([
      ["doc1", "resume-A"],
      ["doc2", "resume-A"],
    ]);
    const resumeNames = new Map([["resume-A", "My CV"]]);
    const result = computeResumePerformance(apps, documentToResumeId, resumeNames);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].resumeId).toBe("resume-A");
    expect(result.entries[0].applications).toBe(2);
    expect(result.entries[0].interviews).toBe(1);
  });

  it("only produces an observation when >=2 resumes each have >=3 applications", () => {
    const apps = [
      makeApp("a1", "doc1", "interview"),
      makeApp("a2", "doc1", "interview"),
      makeApp("a3", "doc1", "applied"),
      makeApp("a4", "doc2", "applied"),
      makeApp("a5", "doc2", "applied"),
    ];
    const documentToResumeId = new Map([
      ["doc1", "resume-A"],
      ["doc2", "resume-B"],
    ]);
    const resumeNames = new Map([
      ["resume-A", "CV A"],
      ["resume-B", "CV B"],
    ]);
    // resume-B only has 2 applications — below the MIN_APPLICATIONS_FOR_OBSERVATION threshold.
    const result = computeResumePerformance(apps, documentToResumeId, resumeNames);
    expect(result.observation).toBeNull();
  });

  it("produces a non-causal observation phrased as 'observed association' when the threshold is met", () => {
    const apps = [
      makeApp("a1", "doc1", "interview"),
      makeApp("a2", "doc1", "interview"),
      makeApp("a3", "doc1", "interview"),
      makeApp("a4", "doc2", "applied"),
      makeApp("a5", "doc2", "applied"),
      makeApp("a6", "doc2", "applied"),
    ];
    const documentToResumeId = new Map([
      ["doc1", "resume-A"],
      ["doc2", "resume-B"],
    ]);
    const resumeNames = new Map([
      ["resume-A", "CV A"],
      ["resume-B", "CV B"],
    ]);
    const result = computeResumePerformance(apps, documentToResumeId, resumeNames);
    expect(result.observation).toContain("observed association");
    expect(result.observation).not.toContain("causes");
  });
});
