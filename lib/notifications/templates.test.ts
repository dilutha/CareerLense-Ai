import { describe, expect, it } from "vitest";
import {
  buildDeadlineReminder,
  buildFollowUpReminder,
  buildInterviewReminder,
  buildStatusChangeNotification,
} from "./templates";

describe("buildFollowUpReminder", () => {
  it("includes the job title and company name", () => {
    const result = buildFollowUpReminder("Software Engineer Intern", "WSO2");
    expect(result.message).toContain("WSO2");
    expect(result.message).toContain("Software Engineer Intern");
  });

  it("falls back to a generic phrase when companyName is null — never prints 'null'", () => {
    const result = buildFollowUpReminder("Data Analyst", null);
    expect(result.message).not.toContain("null");
  });
});

describe("buildInterviewReminder", () => {
  it("produces a distinct message for the 24h and 1h lead times", () => {
    const day = buildInterviewReminder("Data Analyst", "WSO2", "24h");
    const hour = buildInterviewReminder("Data Analyst", "WSO2", "1h");
    expect(day.message).not.toEqual(hour.message);
    expect(day.title.toLowerCase()).toContain("tomorrow");
    expect(hour.title.toLowerCase()).toContain("1 hour");
  });
});

describe("buildDeadlineReminder", () => {
  it("says 'today' when zero days remain", () => {
    const result = buildDeadlineReminder("Intern", "Acme", 0);
    expect(result.title.toLowerCase()).toContain("today");
  });

  it("states the real day count for a multi-day deadline", () => {
    const result = buildDeadlineReminder("Intern", "Acme", 2);
    expect(result.message).toContain("2");
  });
});

describe("buildStatusChangeNotification", () => {
  it("is celebratory for an offer", () => {
    const result = buildStatusChangeNotification("Data Analyst", "WSO2", "final_round", "offer");
    expect(result.title).toContain("🎉");
  });

  it("is supportive, not falsely positive or manipulative, for a rejection", () => {
    const result = buildStatusChangeNotification("Data Analyst", "WSO2", "interview", "rejected");
    expect(result.message.toLowerCase()).not.toContain("🎉");
    expect(result.message).toContain("Awulak na");
  });

  it("frames screening/interview/final_round transitions positively", () => {
    const result = buildStatusChangeNotification("Data Analyst", "WSO2", "applied", "interview");
    expect(result.message).toContain("🎉");
    expect(result.message).toContain("Interview");
  });

  it("never references the old status label directly in a way that could be undefined", () => {
    const result = buildStatusChangeNotification("Data Analyst", "WSO2", null, "screening");
    expect(result.message).not.toContain("undefined");
    expect(result.message).not.toContain("null");
  });
});
