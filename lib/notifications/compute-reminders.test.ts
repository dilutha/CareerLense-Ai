import { describe, expect, it } from "vitest";
import { computeDesiredReminders } from "./compute-reminders";

const NOW = new Date("2026-09-01T04:30:00.000Z"); // 10:00 Colombo

describe("computeDesiredReminders", () => {
  it("returns nothing for an application with no follow-up date, interview, or deadline", () => {
    const result = computeDesiredReminders({
      jobTitle: "Data Analyst", companyName: "WSO2",
      followUpDate: null, interviewAt: null, jobExpiresAt: null, now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("creates exactly one follow_up reminder for a future follow-up date", () => {
    const result = computeDesiredReminders({
      jobTitle: "Data Analyst", companyName: "WSO2",
      followUpDate: "2026-09-05", interviewAt: null, jobExpiresAt: null, now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("application_follow_up");
  });

  it("never creates a follow_up reminder for a follow-up date already in the past", () => {
    const result = computeDesiredReminders({
      jobTitle: "Data Analyst", companyName: "WSO2",
      followUpDate: "2020-01-01", interviewAt: null, jobExpiresAt: null, now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("creates both a 24h-before and a 1h-before interview reminder when the interview is far enough away", () => {
    const interviewAt = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days out
    const result = computeDesiredReminders({
      jobTitle: "Software Engineer", companyName: "WSO2",
      followUpDate: null, interviewAt, jobExpiresAt: null, now: NOW,
    });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.type)).toEqual(["interview_reminder", "interview_reminder"]);
  });

  it("only creates the 1h-before reminder when the interview is less than 24h away", () => {
    const interviewAt = new Date(NOW.getTime() + 5 * 60 * 60 * 1000).toISOString(); // 5 hours out
    const result = computeDesiredReminders({
      jobTitle: "Software Engineer", companyName: "WSO2",
      followUpDate: null, interviewAt, jobExpiresAt: null, now: NOW,
    });
    expect(result).toHaveLength(1);
  });

  it("creates no interview reminder at all when the interview itself is already in the past", () => {
    const interviewAt = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const result = computeDesiredReminders({
      jobTitle: "Software Engineer", companyName: "WSO2",
      followUpDate: null, interviewAt, jobExpiresAt: null, now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("creates a deadline reminder scheduled 2 days before jobExpiresAt when far enough out", () => {
    const jobExpiresAt = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeDesiredReminders({
      jobTitle: "Intern", companyName: "Acme",
      followUpDate: null, interviewAt: null, jobExpiresAt, now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("application_deadline");
    const scheduledMs = result[0].scheduledFor.getTime() - NOW.getTime();
    expect(scheduledMs).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
  });

  it("still surfaces a deadline reminder immediately (not skipped) when fewer than 2 days remain", () => {
    const jobExpiresAt = new Date(NOW.getTime() + 12 * 60 * 60 * 1000).toISOString(); // 12h out
    const result = computeDesiredReminders({
      jobTitle: "Intern", companyName: "Acme",
      followUpDate: null, interviewAt: null, jobExpiresAt, now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].scheduledFor.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("never invents a deadline reminder when jobExpiresAt is null", () => {
    const result = computeDesiredReminders({
      jobTitle: "Intern", companyName: "Acme",
      followUpDate: null, interviewAt: null, jobExpiresAt: null, now: NOW,
    });
    expect(result.find((r) => r.type === "application_deadline")).toBeUndefined();
  });

  it("never creates a deadline reminder for a job that has already expired", () => {
    const jobExpiresAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const result = computeDesiredReminders({
      jobTitle: "Intern", companyName: "Acme",
      followUpDate: null, interviewAt: null, jobExpiresAt, now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("is deterministic — identical inputs always produce identical scheduledFor timestamps (idempotency backbone)", () => {
    const input = {
      jobTitle: "Data Analyst", companyName: "WSO2",
      followUpDate: "2026-09-05", interviewAt: null, jobExpiresAt: null, now: NOW,
    };
    const a = computeDesiredReminders(input);
    const b = computeDesiredReminders(input);
    expect(a[0].scheduledFor.getTime()).toBe(b[0].scheduledFor.getTime());
  });
});
