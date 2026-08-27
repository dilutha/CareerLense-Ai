import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { JobCard } from "@/components/jobs/JobCard";
import { requireUser } from "@/lib/auth/require-user";
import { getJobWithMatch, isJobSaved } from "@/lib/jobs/get-jobs";
import { toJobResultSummary } from "@/lib/jobs/summary";

export default async function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/jobs/${id}`);

  const [result, saved] = await Promise.all([
    getJobWithMatch(user.id, id),
    isJobSaved(user.id, id),
  ]);

  if (!result) notFound();

  const { job, match } = result;
  const summary = toJobResultSummary(result, job.source === "demo");

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/jobs"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to jobs
        </Link>

        <JobCard summary={summary} initiallySaved={saved} />

        <Link
          href={`/application/${job.id}`}
          className="flex w-fit items-center gap-2 rounded-full bg-sea-gradient px-6 py-3 text-sm font-semibold text-white shadow-md shadow-ocean/20 transition-transform hover:scale-[1.02]"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Tailor My Application
        </Link>

        {match?.explanation && (
          <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-navy">Why this job matches you</p>
            {match.explanation.positives.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {match.explanation.positives.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-navy-light/80">
                    <span className="text-emerald-600">✓</span> {p}
                  </li>
                ))}
              </ul>
            )}
            {match.explanation.gaps.length > 0 && (
              <>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                  Gaps
                </p>
                <ul className="flex flex-col gap-1.5">
                  {match.explanation.gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-navy-light/80">
                      <span className="text-amber-500">⚠</span> {g}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-4 border-t border-navy/10 pt-3 text-xs text-navy-light/50">
              Match based on your CareerLens profile and selected CV. This is an estimate, not a
              guarantee.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-navy">Description</p>
          <p className="whitespace-pre-line text-sm text-navy-light/80">
            {job.description ?? "No description provided by the source."}
          </p>

          {job.responsibilities && (
            <>
              <p className="mb-2 mt-4 text-sm font-semibold text-navy">Responsibilities</p>
              <p className="whitespace-pre-line text-sm text-navy-light/80">
                {job.responsibilities}
              </p>
            </>
          )}

          {job.requirements && (
            <>
              <p className="mb-2 mt-4 text-sm font-semibold text-navy">Requirements</p>
              <p className="whitespace-pre-line text-sm text-navy-light/80">{job.requirements}</p>
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-navy/10 pt-4 text-sm">
            <span className="text-navy-light/60">
              {job.salary_text ?? "Salary not disclosed"}
            </span>
            <span className="text-navy-light/60">
              {job.posted_at
                ? `Posted ${new Date(job.posted_at).toLocaleDateString()}`
                : "Posted date unavailable"}
            </span>
            <span className="text-navy-light/60">Source: {job.source === "demo" ? "Demo Data" : job.source}</span>
            <a
              href={job.application_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 rounded-full bg-sea-gradient px-4 py-2 font-semibold text-white"
            >
              Apply on source
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
