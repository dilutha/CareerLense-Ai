import { BackLink } from "@/components/ui/BackLink";
import { JobResultList } from "@/components/jobs/JobResultList";
import { requireUser } from "@/lib/auth/require-user";
import { getSavedJobsForUser } from "@/lib/jobs/get-jobs";
import { toJobResultSummary } from "@/lib/jobs/summary";

export default async function SavedJobsPage() {
  const user = await requireUser("/jobs/saved");
  const saved = await getSavedJobsForUser(user.id);
  const summaries = saved.map((item) => toJobResultSummary(item, item.job.source === "demo"));

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BackLink href="/jobs" label="Back to jobs" />

        <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
          Saved jobs
        </h1>

        <JobResultList
          jobs={summaries}
          savedJobIds={summaries.map((s) => s.id)}
          emptyMessage="No saved jobs yet — tap Save on a job you want to come back to."
        />
      </div>
    </main>
  );
}
