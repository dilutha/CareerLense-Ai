import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeDesiredReminders } from "./compute-reminders";
import { reconcileReminders, type ExistingScheduledReminder } from "./reconcile";
import type { NotificationRow } from "./types";

const SCHEDULED_TYPES = ["application_follow_up", "interview_reminder", "application_deadline"] as const;

interface SyncInput {
  applicationId: string;
  jobId: string;
  profileId: string;
  jobTitle: string;
  companyName: string | null;
  followUpDate: string | null;
  interviewAt: string | null;
  jobExpiresAt: string | null;
}

/**
 * Reconciles this application's follow-up/interview/deadline reminders
 * against its current source dates (follow_up_date, interview_at,
 * jobs.expires_at). Safe to call repeatedly — idempotent by construction
 * (see compute-reminders.ts + reconcile.ts + the DB's UNIQUE constraint,
 * which is the final backstop against a race between two concurrent
 * calls). Called from lib/applications/actions.ts whenever one of those
 * source dates could have changed: trackApplication (picks up
 * jobs.expires_at for the first time), setFollowUpDate, setInterviewAt.
 */
export async function syncApplicationReminders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: SyncInput
): Promise<void> {
  const desired = computeDesiredReminders({
    jobTitle: input.jobTitle,
    companyName: input.companyName,
    followUpDate: input.followUpDate,
    interviewAt: input.interviewAt,
    jobExpiresAt: input.jobExpiresAt,
  });

  const { data: existingRows } = await supabase
    .from("notifications")
    .select("id, type, scheduled_for")
    .eq("profile_id", input.profileId)
    .eq("related_application_id", input.applicationId)
    .in("type", SCHEDULED_TYPES)
    .is("sent_at", null);

  const existingUnsent: ExistingScheduledReminder[] = ((existingRows ?? []) as Pick<NotificationRow, "id" | "type" | "scheduled_for">[]).map(
    (r) => ({ id: r.id, type: r.type, scheduledFor: new Date(r.scheduled_for) })
  );

  const { toInsert, toDeleteIds } = reconcileReminders(desired, existingUnsent);

  if (toDeleteIds.length > 0) {
    await supabase.from("notifications").delete().in("id", toDeleteIds).eq("profile_id", input.profileId);
  }

  if (toInsert.length > 0) {
    const rows = toInsert.map((r) => ({
      profile_id: input.profileId,
      type: r.type,
      title: r.title,
      message: r.message,
      related_application_id: input.applicationId,
      related_job_id: input.jobId,
      scheduled_for: r.scheduledFor.toISOString(),
    }));
    // Duplicate-safe: the same (profile_id, related_application_id, type,
    // scheduled_for) tuple can't be inserted twice even under a race with
    // another concurrent sync call, thanks to the DB's UNIQUE constraint.
    const { error } = await supabase.from("notifications").insert(rows);
    if (error && error.code !== "23505") {
      console.error("[notifications] syncApplicationReminders insert failed:", error.message);
    }
  }
}
