"use client";

import { JobResultList } from "@/components/jobs/JobResultList";
import type { JobResultSummary } from "@/lib/jobs/summary";

export function JobResultsMessage({ jobs }: { jobs: JobResultSummary[] }) {
  return (
    <div className="w-full max-w-[90%] sm:max-w-[80%]">
      <JobResultList jobs={jobs} compact />
    </div>
  );
}
