import { describe, expect, it } from "vitest";
import { reconcileReminders } from "./reconcile";
import type { DesiredReminder } from "./compute-reminders";

function desired(type: DesiredReminder["type"], scheduledFor: Date): DesiredReminder {
  return { type, scheduledFor, title: "t", message: "m" };
}

describe("reconcileReminders", () => {
  it("inserts everything when nothing currently exists", () => {
    const d = [desired("application_follow_up", new Date("2026-09-05T03:30:00Z"))];
    const result = reconcileReminders(d, []);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toDeleteIds).toEqual([]);
  });

  it("inserts nothing and deletes nothing when the existing row exactly matches the desired one (idempotent re-sync)", () => {
    const scheduledFor = new Date("2026-09-05T03:30:00Z");
    const d = [desired("application_follow_up", scheduledFor)];
    const existing = [{ id: "n1", type: "application_follow_up" as const, scheduledFor }];
    const result = reconcileReminders(d, existing);
    expect(result.toInsert).toEqual([]);
    expect(result.toDeleteIds).toEqual([]);
  });

  it("deletes the stale reminder and inserts the new one when the source date changed", () => {
    const oldDate = new Date("2026-09-05T03:30:00Z");
    const newDate = new Date("2026-09-10T03:30:00Z");
    const d = [desired("application_follow_up", newDate)];
    const existing = [{ id: "n1", type: "application_follow_up" as const, scheduledFor: oldDate }];
    const result = reconcileReminders(d, existing);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toDeleteIds).toEqual(["n1"]);
  });

  it("deletes a reminder whose source date was cleared entirely (desired list no longer includes it)", () => {
    const existing = [{ id: "n1", type: "application_follow_up" as const, scheduledFor: new Date() }];
    const result = reconcileReminders([], existing);
    expect(result.toInsert).toEqual([]);
    expect(result.toDeleteIds).toEqual(["n1"]);
  });

  it("leaves other reminder types alone when only one type changes", () => {
    const interviewDate = new Date("2026-09-08T00:00:00Z");
    const d = [desired("interview_reminder", interviewDate)];
    const existing = [
      { id: "n1", type: "interview_reminder" as const, scheduledFor: interviewDate },
      { id: "n2", type: "application_deadline" as const, scheduledFor: new Date("2026-09-09T00:00:00Z") },
    ];
    const result = reconcileReminders(d, existing);
    expect(result.toInsert).toEqual([]);
    expect(result.toDeleteIds).toEqual(["n2"]);
  });
});
