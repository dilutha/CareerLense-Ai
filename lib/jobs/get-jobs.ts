import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Job, JobMatch, JobSkillRow, JobWithMatch, SavedJob } from "./types";

export async function getJobWithMatch(userId: string, jobId: string): Promise<JobWithMatch | null> {
  const supabase = await createServerSupabaseClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return null;

  const [{ data: skills }, { data: match }] = await Promise.all([
    supabase.from("job_skills").select("*").eq("job_id", jobId),
    supabase
      .from("job_matches")
      .select("*")
      .eq("job_id", jobId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  return {
    job: job as Job,
    skills: (skills ?? []) as JobSkillRow[],
    match: (match as JobMatch) ?? null,
  };
}

export async function getSavedJobsForUser(userId: string): Promise<JobWithMatch[]> {
  const supabase = await createServerSupabaseClient();

  const { data: saved } = await supabase
    .from("saved_jobs")
    .select("job_id")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  const jobIds = ((saved ?? []) as SavedJob[]).map((s) => s.job_id);
  if (jobIds.length === 0) return [];

  const [{ data: jobs }, { data: skills }, { data: matches }] = await Promise.all([
    supabase.from("jobs").select("*").in("id", jobIds),
    supabase.from("job_skills").select("*").in("job_id", jobIds),
    supabase.from("job_matches").select("*").eq("profile_id", userId).in("job_id", jobIds),
  ]);

  const skillsByJob = new Map<string, JobSkillRow[]>();
  for (const row of (skills ?? []) as JobSkillRow[]) {
    const list = skillsByJob.get(row.job_id) ?? [];
    list.push(row);
    skillsByJob.set(row.job_id, list);
  }
  const matchByJob = new Map<string, JobMatch>();
  for (const row of (matches ?? []) as JobMatch[]) {
    matchByJob.set(row.job_id, row);
  }

  const jobsById = new Map<string, Job>();
  for (const job of (jobs ?? []) as Job[]) {
    jobsById.set(job.id, job);
  }

  return jobIds
    .map((id) => jobsById.get(id))
    .filter((job): job is Job => Boolean(job))
    .map((job) => ({
      job,
      skills: skillsByJob.get(job.id) ?? [],
      match: matchByJob.get(job.id) ?? null,
    }));
}

export async function isJobSaved(userId: string, jobId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("saved_jobs")
    .select("id")
    .eq("profile_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();
  return Boolean(data);
}
