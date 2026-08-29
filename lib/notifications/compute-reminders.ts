import type { NotificationType } from "./schemas";
import {
  buildDeadlineReminder,
  buildFollowUpReminder,
  buildInterviewReminder,
  type NotificationContent,
} from "./templates";

export interface DesiredReminder extends NotificationContent {
  type: NotificationType;
  scheduledFor: Date;
}

export interface ComputeRemindersInput {
  jobTitle: string;
  companyName: string | null;
  /** applications.follow_up_date — a plain date (YYYY-MM-DD), or null. */
  followUpDate: string | null;
  /** applications.interview_at — a real timestamp, or null. */
  interviewAt: string | null;
  /** jobs.expires_at — real source data only, never invented; null if the source didn't provide one. */
  jobExpiresAt: string | null;
  now?: Date;
}

const INTERVIEW_LEAD_TIMES_MS = [24 * 60 * 60 * 1000, 60 * 60 * 1000] as const;
const DEADLINE_LEAD_DAYS = 2;
const FOLLOW_UP_DEFAULT_HOUR = 9;

/**
 * Pure, deterministic computation of the reminders that SHOULD exist
 * right now for one application, given its current source dates. No
 * database access, no Gemini — the same source dates always produce the
 * same result, which is what makes lib/notifications/sync.ts's
 * reconciliation (and the DB's UNIQUE constraint) safely idempotent.
 * Never returns a reminder scheduled in the past — a reminder for
 * something that already happened isn't useful, and PROJECT_SPEC's own
 * "never spam" rule rules out re-surfacing something stale.
 */
export function computeDesiredReminders(input: ComputeRemindersInput): DesiredReminder[] {
  const now = input.now ?? new Date();
  const reminders: DesiredReminder[] = [];

  if (input.followUpDate) {
    const [year, month, day] = input.followUpDate.split("-").map(Number);
    // followUpDate is a plain date (no time zone in the column) — treat
    // it as a Colombo-local date at a sensible default hour.
    const scheduledFor = new Date(Date.UTC(year, month - 1, day, FOLLOW_UP_DEFAULT_HOUR - 5, 30));
    if (scheduledFor.getTime() > now.getTime()) {
      reminders.push({
        type: "application_follow_up",
        scheduledFor,
        ...buildFollowUpReminder(input.jobTitle, input.companyName),
      });
    }
  }

  if (input.interviewAt) {
    const interviewTime = new Date(input.interviewAt).getTime();
    if (!Number.isNaN(interviewTime) && interviewTime > now.getTime()) {
      const leadLabels: Array<"24h" | "1h"> = ["24h", "1h"];
      INTERVIEW_LEAD_TIMES_MS.forEach((leadMs, i) => {
        const scheduledFor = new Date(interviewTime - leadMs);
        if (scheduledFor.getTime() > now.getTime()) {
          reminders.push({
            type: "interview_reminder",
            scheduledFor,
            ...buildInterviewReminder(input.jobTitle, input.companyName, leadLabels[i]),
          });
        }
      });
    }
  }

  if (input.jobExpiresAt) {
    const expiresTime = new Date(input.jobExpiresAt).getTime();
    if (!Number.isNaN(expiresTime) && expiresTime > now.getTime()) {
      const leadMs = DEADLINE_LEAD_DAYS * 24 * 60 * 60 * 1000;
      const naturalScheduledFor = expiresTime - leadMs;
      // If fewer than DEADLINE_LEAD_DAYS remain, still surface it right
      // away (now) rather than skipping it just because the "2 days
      // before" point has already passed.
      const scheduledFor = new Date(Math.max(naturalScheduledFor, now.getTime() + 1000));
      const daysLeft = Math.max(0, Math.ceil((expiresTime - now.getTime()) / (24 * 60 * 60 * 1000)));
      reminders.push({
        type: "application_deadline",
        scheduledFor,
        ...buildDeadlineReminder(input.jobTitle, input.companyName, daysLeft),
      });
    }
  }

  return reminders;
}
