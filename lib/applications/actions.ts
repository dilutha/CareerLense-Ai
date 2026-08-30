"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOptionalUser } from "@/lib/auth/require-user";
import { ensureProfileExists } from "@/lib/career-profile/ensure-profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createStatusChangeNotification } from "@/lib/notifications/status-change";
import { syncApplicationReminders } from "@/lib/notifications/sync";
import { isValidApplicationStatus, type ApplicationStatus } from "./schemas";
import type { ApplicationRow } from "./types";

interface JobReminderFields {
  title: string;
  company_name: string | null;
  expires_at: string | null;
}

/** Fetches only the fields reminder sync/notifications need — never the full job row. */
async function getJobReminderFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  jobId: string
): Promise<JobReminderFields | null> {
  const { data } = await supabase.from("jobs").select("title, company_name, expires_at").eq("id", jobId).maybeSingle();
  return (data as JobReminderFields | null) ?? null;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

/** Starts tracking a job — idempotent, safe to call again (e.g. from both /jobs and chat). */
export async function trackApplication(
  jobId: string,
  initialStatus: ApplicationStatus = "saved"
): Promise<ActionResult & { applicationId?: string }> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return trackApplicationCore(user.id, supabase, jobId, initialStatus);
}

/** Extracted for /api/v1/applications POST — same reasoning as lib/resume/actions.ts#processResumeCore. */
export async function trackApplicationCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  jobId: string,
  initialStatus: ApplicationStatus = "saved"
): Promise<ActionResult & { applicationId?: string }> {
  if (!isValidApplicationStatus(initialStatus)) {
    return { success: false, error: "That's not a valid status." };
  }

  await ensureProfileExists(userId, supabase);

  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("profile_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();

  if (existing) {
    return { success: true, applicationId: (existing as { id: string }).id };
  }

  const { data: inserted, error } = await supabase
    .from("applications")
    .insert({ profile_id: userId, job_id: jobId, status: initialStatus })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[applications] trackApplication failed:", error?.message);
    return { success: false, error: "Couldn't start tracking this application. Try again." };
  }

  const applicationId = (inserted as { id: string }).id;

  const { error: historyError } = await supabase.from("application_status_history").insert({
    application_id: applicationId,
    profile_id: userId,
    old_status: null,
    new_status: initialStatus,
  });
  if (historyError) {
    console.error("[applications] Recording initial status history failed:", historyError.message);
  }

  // Picks up jobs.expires_at (if the source ever populates it) as a
  // deadline reminder the moment tracking starts — never invents a
  // deadline when the source didn't provide one (Part 7).
  const job = await getJobReminderFields(supabase, jobId);
  if (job) {
    await syncApplicationReminders(supabase, {
      applicationId,
      jobId,
      profileId: userId,
      jobTitle: job.title,
      companyName: job.company_name,
      followUpDate: null,
      interviewAt: null,
      jobExpiresAt: job.expires_at,
    });
  }

  revalidatePath("/applications");
  return { success: true, applicationId };
}

/** Updates status and records the transition in application_status_history — append-only, never rewritten. */
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus,
  note?: string
): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return updateApplicationStatusCore(user.id, supabase, applicationId, newStatus, note);
}

/** Extracted for /api/v1/applications/[id] PATCH — same reasoning as lib/resume/actions.ts#processResumeCore. */
export async function updateApplicationStatusCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  applicationId: string,
  newStatus: ApplicationStatus,
  note?: string
): Promise<ActionResult> {
  if (!isValidApplicationStatus(newStatus)) {
    return { success: false, error: "That's not a valid status." };
  }

  const { data: current } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!current) return { success: false, error: "Couldn't find that application." };
  const row = current as ApplicationRow;

  const update: Record<string, unknown> = {
    status: newStatus,
    last_status_changed_at: new Date().toISOString(),
  };
  if (newStatus === "applied" && !row.applied_at) {
    update.applied_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("applications")
    .update(update)
    .eq("id", applicationId)
    .eq("profile_id", userId);

  if (error) {
    console.error("[applications] updateApplicationStatus failed:", error.message);
    return { success: false, error: "Couldn't update the status. Try again." };
  }

  const { data: historyRow, error: historyError } = await supabase
    .from("application_status_history")
    .insert({
      application_id: applicationId,
      profile_id: userId,
      old_status: row.status,
      new_status: newStatus,
      note: note ?? null,
    })
    .select("id")
    .single();
  if (historyError) {
    console.error("[applications] Recording status history failed:", historyError.message);
  } else if (historyRow) {
    const job = await getJobReminderFields(supabase, row.job_id);
    await createStatusChangeNotification(supabase, {
      profileId: userId,
      applicationId,
      jobId: row.job_id,
      statusHistoryId: (historyRow as { id: string }).id,
      jobTitle: job?.title ?? "this role",
      companyName: job?.company_name ?? null,
      oldStatus: row.status,
      newStatus,
    });
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/notifications");
  return { success: true };
}

/** Removes a tracked application entirely (cascades to its status history). Not previously exposed anywhere — added for /api/v1/applications/[id] DELETE (Part 14). */
export async function deleteApplicationCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  applicationId: string
): Promise<ActionResult> {
  const { error } = await supabase.from("applications").delete().eq("id", applicationId).eq("profile_id", userId);
  if (error) return { success: false, error: "Couldn't delete that application." };

  revalidatePath("/applications");
  return { success: true };
}

export async function setFollowUpDate(applicationId: string, date: string | null): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { data: current } = await supabase
    .from("applications")
    .select("job_id, interview_at")
    .eq("id", applicationId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!current) return { success: false, error: "Couldn't find that application." };
  const { job_id: jobId, interview_at: interviewAt } = current as { job_id: string; interview_at: string | null };

  const { error } = await supabase
    .from("applications")
    .update({ follow_up_date: date })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't set the follow-up date." };

  const job = await getJobReminderFields(supabase, jobId);
  if (job) {
    await syncApplicationReminders(supabase, {
      applicationId,
      jobId,
      profileId: user.id,
      jobTitle: job.title,
      companyName: job.company_name,
      followUpDate: date,
      interviewAt,
      jobExpiresAt: job.expires_at,
    });
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  return { success: true };
}

/** Sets/clears the real scheduled interview date+time (ISO timestamp) for this application and re-syncs its reminders. */
export async function setInterviewAt(applicationId: string, isoDateTime: string | null): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  if (isoDateTime !== null && Number.isNaN(new Date(isoDateTime).getTime())) {
    return { success: false, error: "That doesn't look like a valid date/time." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: current } = await supabase
    .from("applications")
    .select("job_id, follow_up_date")
    .eq("id", applicationId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!current) return { success: false, error: "Couldn't find that application." };
  const { job_id: jobId, follow_up_date: followUpDate } = current as { job_id: string; follow_up_date: string | null };

  const { error } = await supabase
    .from("applications")
    .update({ interview_at: isoDateTime })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't set the interview date." };

  const job = await getJobReminderFields(supabase, jobId);
  if (job) {
    await syncApplicationReminders(supabase, {
      applicationId,
      jobId,
      profileId: user.id,
      jobTitle: job.title,
      companyName: job.company_name,
      followUpDate,
      interviewAt: isoDateTime,
      jobExpiresAt: job.expires_at,
    });
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  return { success: true };
}

export async function updateApplicationNotes(applicationId: string, notes: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("applications")
    .update({ notes })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't save your notes." };

  revalidatePath(`/applications/${applicationId}`);
  return { success: true };
}

/** Links an already-tailored CV/cover-letter document to this application, so the detail page can show "Applied with: CV Version X". */
export async function linkApplicationDocument(applicationId: string, applicationDocumentId: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();

  const { data: doc } = await supabase
    .from("application_documents")
    .select("id")
    .eq("id", applicationDocumentId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!doc) return { success: false, error: "Couldn't find that CV/cover letter." };

  const { error } = await supabase
    .from("applications")
    .update({ application_document_id: applicationDocumentId })
    .eq("id", applicationId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't link that document." };

  revalidatePath(`/applications/${applicationId}`);
  return { success: true };
}
