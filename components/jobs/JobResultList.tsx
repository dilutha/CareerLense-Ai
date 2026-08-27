import type { JobResultSummary } from "@/lib/jobs/summary";
import { JobCard } from "./JobCard";

export function JobResultList({
  jobs,
  savedJobIds = [],
  compact = false,
  emptyMessage = "Couldn't find a strong match yet 😅",
}: {
  jobs: JobResultSummary[];
  savedJobIds?: string[];
  compact?: boolean;
  emptyMessage?: string;
}) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          summary={job}
          initiallySaved={savedJobIds.includes(job.id)}
          compact={compact}
        />
      ))}
    </div>
  );
}
