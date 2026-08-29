import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Job, JobMatch } from "@/lib/jobs/types";
import type { ApplicationDocument, ApplicationDocumentVersion, CoverLetterRow } from "@/lib/application/types";
import type { ApplicationRow, ApplicationStatusHistoryRow } from "./types";

export interface ApplicationWithJob {
  application: ApplicationRow;
  job: Job;
  match: JobMatch | null;
}

export async function getApplicationsForUser(userId: string): Promise<ApplicationWithJob[]> {
  const supabase = await createServerSupabaseClient();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("profile_id", userId)
    .order("updated_at", { ascending: false });

  const rows = (applications ?? []) as ApplicationRow[];
  if (rows.length === 0) return [];

  const jobIds = rows.map((a) => a.job_id);
  const [{ data: jobs }, { data: matches }] = await Promise.all([
    supabase.from("jobs").select("*").in("id", jobIds),
    supabase.from("job_matches").select("*").eq("profile_id", userId).in("job_id", jobIds),
  ]);

  const jobsById = new Map<string, Job>();
  for (const job of (jobs ?? []) as Job[]) jobsById.set(job.id, job);
  const matchByJob = new Map<string, JobMatch>();
  for (const match of (matches ?? []) as JobMatch[]) matchByJob.set(match.job_id, match);

  return rows
    .map((application) => {
      const job = jobsById.get(application.job_id);
      if (!job) return null;
      return { application, job, match: matchByJob.get(job.id) ?? null };
    })
    .filter((r): r is ApplicationWithJob => r !== null);
}

export interface ApplicationDetail extends ApplicationWithJob {
  statusHistory: ApplicationStatusHistoryRow[];
  applicationDocument: ApplicationDocument | null;
  cvVersion: ApplicationDocumentVersion | null;
  coverLetter: CoverLetterRow | null;
}

export async function getApplicationDetail(userId: string, applicationId: string): Promise<ApplicationDetail | null> {
  const supabase = await createServerSupabaseClient();

  const { data: application } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!application) return null;
  const row = application as ApplicationRow;

  const [{ data: job }, { data: match }, { data: history }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", row.job_id).maybeSingle(),
    supabase.from("job_matches").select("*").eq("profile_id", userId).eq("job_id", row.job_id).maybeSingle(),
    supabase
      .from("application_status_history")
      .select("*")
      .eq("application_id", applicationId)
      .eq("profile_id", userId)
      .order("changed_at", { ascending: false }),
  ]);

  if (!job) return null;

  let applicationDocument: ApplicationDocument | null = null;
  let cvVersion: ApplicationDocumentVersion | null = null;
  let coverLetter: CoverLetterRow | null = null;

  if (row.application_document_id) {
    const [{ data: doc }, { data: version }, { data: letter }] = await Promise.all([
      supabase.from("application_documents").select("*").eq("id", row.application_document_id).maybeSingle(),
      supabase
        .from("application_document_versions")
        .select("*")
        .eq("application_document_id", row.application_document_id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cover_letters")
        .select("*")
        .eq("application_document_id", row.application_document_id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    applicationDocument = (doc as ApplicationDocument) ?? null;
    cvVersion = (version as ApplicationDocumentVersion) ?? null;
    coverLetter = (letter as CoverLetterRow) ?? null;
  }

  return {
    application: row,
    job: job as Job,
    match: (match as JobMatch) ?? null,
    statusHistory: (history ?? []) as ApplicationStatusHistoryRow[],
    applicationDocument,
    cvVersion,
    coverLetter,
  };
}

export async function getApplicationIdForJob(userId: string, jobId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("applications")
    .select("id")
    .eq("profile_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function getUpcomingFollowUps(userId: string): Promise<ApplicationWithJob[]> {
  const all = await getApplicationsForUser(userId);
  const today = new Date().toISOString().slice(0, 10);
  return all
    .filter((a) => a.application.follow_up_date && a.application.follow_up_date >= today)
    .sort((a, b) => (a.application.follow_up_date! < b.application.follow_up_date! ? -1 : 1));
}
