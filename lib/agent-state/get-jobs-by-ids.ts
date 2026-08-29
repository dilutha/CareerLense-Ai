import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Job, JobMatch, JobWithMatch } from "@/lib/jobs/types";

/**
 * Re-fetches specific jobs (+ this user's own cached match) by ID, in the
 * SAME order as `jobIds` — used to rebuild grounded context on a turn
 * where no new search ran (e.g. "second eka gana kiyanna"), rather than
 * duplicating job data inside agent_state itself (which only stores the
 * IDs — see schema.ts). Always fresh, never stale, consistent with this
 * project's "compute live" pattern elsewhere.
 */
export async function getJobsByIds(userId: string, jobIds: string[]): Promise<JobWithMatch[]> {
  if (jobIds.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const [{ data: jobs }, { data: matches }] = await Promise.all([
    supabase.from("jobs").select("*").in("id", jobIds),
    supabase.from("job_matches").select("*").eq("profile_id", userId).in("job_id", jobIds),
  ]);

  const jobsById = new Map<string, Job>();
  for (const job of (jobs ?? []) as Job[]) jobsById.set(job.id, job);
  const matchByJob = new Map<string, JobMatch>();
  for (const match of (matches ?? []) as JobMatch[]) matchByJob.set(match.job_id, match);

  return jobIds
    .map((id) => jobsById.get(id))
    .filter((job): job is Job => job !== undefined)
    .map((job) => ({ job, skills: [], match: matchByJob.get(job.id) ?? null }));
}
