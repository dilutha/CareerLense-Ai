import Link from "next/link";
import { Bookmark } from "lucide-react";
import { JobSearchPage } from "@/components/jobs/JobSearchPage";
import { requireUser } from "@/lib/auth/require-user";
import { getSavedJobsForUser } from "@/lib/jobs/get-jobs";
import { SOURCE_REGISTRY } from "@/lib/jobs/providers/registry";

export default async function JobsPage() {
  const user = await requireUser("/jobs");
  const saved = await getSavedJobsForUser(user.id);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              Find jobs
            </h1>
            <p className="text-sm text-navy-light/70">
              Sri Lanka-first — matched against your career profile and CV.
            </p>
          </div>
          <Link
            href="/jobs/saved"
            className="flex items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
          >
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            Saved ({saved.length})
          </Link>
        </div>

        <JobSearchPage savedJobIds={saved.map((s) => s.job.id)} sourceRegistry={SOURCE_REGISTRY} />
      </div>
    </main>
  );
}
