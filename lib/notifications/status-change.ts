import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationStatus } from "@/lib/applications/schemas";
import { buildStatusChangeNotification } from "./templates";

/**
 * Creates a status_change notification tied 1:1 to the
 * application_status_history row that caused it — the UNIQUE constraint
 * on notifications.related_status_history_id (migration 009) makes this
 * safe to retry: a duplicate insert for the same history row fails the
 * constraint (23505) rather than creating a second notification, which
 * is treated as "already recorded," not an error.
 */
export async function createStatusChangeNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: {
    profileId: string;
    applicationId: string;
    jobId: string;
    statusHistoryId: string;
    jobTitle: string;
    companyName: string | null;
    oldStatus: ApplicationStatus | null;
    newStatus: ApplicationStatus;
  }
): Promise<void> {
  const content = buildStatusChangeNotification(input.jobTitle, input.companyName, input.oldStatus, input.newStatus);
  const now = new Date().toISOString();

  const { error } = await supabase.from("notifications").insert({
    profile_id: input.profileId,
    type: "status_change",
    title: content.title,
    message: content.message,
    related_application_id: input.applicationId,
    related_job_id: input.jobId,
    related_status_history_id: input.statusHistoryId,
    scheduled_for: now,
    sent_at: now, // already "current" the moment it's written — no future scheduling needed
  });

  if (error && error.code !== "23505") {
    console.error("[notifications] createStatusChangeNotification failed:", error.message);
  }
}
