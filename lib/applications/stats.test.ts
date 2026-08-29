import { describe, expect, it } from "vitest";
import { computeApplicationStats } from "./stats";
import type { ApplicationRow, ApplicationStatusHistoryRow } from "./types";
import type { ApplicationStatus } from "./schemas";

function makeApp(overrides: Partial<ApplicationRow>): ApplicationRow {
  return {
    id: "a1",
    profile_id: "p1",
    job_id: "j1",
    application_document_id: null,
    status: "saved",
    notes: null,
    follow_up_date: null,
    interview_at: null,
    applied_at: null,
    last_status_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function historyEntry(applicationId: string, newStatus: ApplicationStatus): ApplicationStatusHistoryRow {
  return {
    id: `h-${applicationId}-${newStatus}`,
    application_id: applicationId,
    profile_id: "p1",
    old_status: null,
    new_status: newStatus,
    changed_at: new Date().toISOString(),
    note: null,
  };
}

describe("computeApplicationStats", () => {
  it("returns all-zero/null stats for zero applications — never NaN or crashes", () => {
    const stats = computeApplicationStats([], new Map());
    expect(stats.total).toBe(0);
    expect(stats.interviewRate).toBeNull();
    expect(stats.offerRate).toBeNull();
    expect(stats.responseRate).toBeNull();
    expect(Number.isNaN(stats.interviewRate)).toBe(false);
  });

  it("never divides by zero when nothing has been submitted yet (all 'saved')", () => {
    const apps = [makeApp({ id: "a1", status: "saved" }), makeApp({ id: "a2", status: "interested" })];
    const stats = computeApplicationStats(apps, new Map());
    expect(stats.total).toBe(2);
    expect(stats.interviewRate).toBeNull();
    expect(stats.offerRate).toBeNull();
  });

  it("computes interview rate and offer rate correctly from submitted applications", () => {
    const apps = [
      makeApp({ id: "a1", status: "applied", applied_at: new Date().toISOString() }),
      makeApp({ id: "a2", status: "interview", applied_at: new Date().toISOString() }),
      makeApp({ id: "a3", status: "offer", applied_at: new Date().toISOString() }),
      makeApp({ id: "a4", status: "rejected", applied_at: new Date().toISOString() }),
    ];
    const stats = computeApplicationStats(apps, new Map());
    // 4 submitted, 2 reached interview (a2 interview, a3 offer), 1 offer.
    expect(stats.interviewRate).toBe(50);
    expect(stats.offerRate).toBe(25);
  });

  it("counts a rejection that followed an interview as having reached interview, via status history", () => {
    const apps = [makeApp({ id: "a1", status: "rejected", applied_at: new Date().toISOString() })];
    const history = new Map([["a1", [historyEntry("a1", "applied"), historyEntry("a1", "interview"), historyEntry("a1", "rejected")]]]);
    const stats = computeApplicationStats(apps, history);
    expect(stats.interviews).toBe(1);
  });

  it("does NOT count a rejection with no interview in its history as having reached interview", () => {
    const apps = [makeApp({ id: "a1", status: "rejected", applied_at: new Date().toISOString() })];
    const history = new Map([["a1", [historyEntry("a1", "applied"), historyEntry("a1", "rejected")]]]);
    const stats = computeApplicationStats(apps, history);
    expect(stats.interviews).toBe(0);
  });

  it("counts 'active' as anything not in a terminal state", () => {
    const apps = [
      makeApp({ id: "a1", status: "interview" }),
      makeApp({ id: "a2", status: "offer" }),
      makeApp({ id: "a3", status: "rejected" }),
      makeApp({ id: "a4", status: "closed" }),
    ];
    const stats = computeApplicationStats(apps, new Map());
    expect(stats.active).toBe(1); // only "interview"
  });
});
