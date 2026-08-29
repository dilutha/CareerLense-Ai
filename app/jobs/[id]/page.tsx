import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { JobCard } from "@/components/jobs/JobCard";
import { JobReadinessPanel } from "@/components/jobs/JobReadinessPanel";
import { PrepareInterviewButton } from "@/components/jobs/PrepareInterviewButton";
import { TrackApplicationButton } from "@/components/applications/TrackApplicationButton";
import { requireUser } from "@/lib/auth/require-user";
import { getApplicationIdForJob } from "@/lib/applications/get-applications";
import { getJobReadiness } from "@/lib/career/get-job-readiness";
import { getJobWithMatch, getRelatedSourceJobs, isJobSaved } from "@/lib/jobs/get-jobs";
import { getSourceConfidence } from "@/lib/jobs/source-confidence";
import { toJobResultSummary } from "@/lib/jobs/summary";

export default async function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/jobs/${id}`);

  const [result, saved, existingApplicationId] = await Promise.all([
    getJobWithMatch(user.id, id),
    isJobSaved(user.id, id),
    getApplicationIdForJob(user.id, id),
  ]);

  if (!result) notFound();

  const { job, match } = result;
  const readiness = await getJobReadiness(user.id, id, match);
  const summary = toJobResultSummary(result, job.source === "demo");
  const relatedSources = job.source !== "demo" ? await getRelatedSourceJobs(job) : [];
  const isDemo = job.source === "demo";
  const sourceLabel = isDemo ? "Demo Data" : (job.source_name ?? job.source);
  const sourceConfidence = getSourceConfidence(job.source_type);
  const hasDistinctSourceUrl =
    job.source_url && job.source_url !== job.application_url;

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

        {relatedSources.length > 0 && (
          <p className="text-xs text-navy-light/60">
            Also listed on:{" "}
            {relatedSources
              .map((r) => r.source_name ?? r.source)
              .join(", ")}
            {" — likely the same vacancy, shown once here to avoid duplicates."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/application/${job.id}`}
            className="flex w-fit items-center gap-2 rounded-full bg-sea-gradient px-6 py-3 text-sm font-semibold text-white shadow-md shadow-ocean/20 transition-transform hover:scale-[1.02]"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Tailor My Application
          </Link>
          <PrepareInterviewButton jobId={job.id} />
          {existingApplicationId ? (
            <Link
              href={`/applications/${existingApplicationId}`}
              className="flex w-fit items-center gap-2 rounded-full border border-navy/10 px-6 py-3 text-sm font-semibold text-navy hover:bg-foam"
            >
              View tracked application
            </Link>
          ) : (
            <TrackApplicationButton jobId={job.id} alreadyTracked={false} />
          )}
        </div>

        <JobReadinessPanel readiness={readiness} />

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
            <span className="text-navy-light/60">
              Source: {sourceLabel}
              {!isDemo && (
                <span
                  className={
                    sourceConfidence === "HIGH"
                      ? " text-emerald-600"
                      : sourceConfidence === "MEDIUM"
                        ? " text-amber-600"
                        : " text-navy-light/40"
                  }
                >
                  {" "}
                  · {sourceConfidence.charAt(0) + sourceConfidence.slice(1).toLowerCase()} confidence
                </span>
              )}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {hasDistinctSourceUrl && (
                <a
                  href={job.source_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-navy/10 px-4 py-2 font-medium text-navy hover:bg-foam"
                >
                  View on {sourceLabel}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-sea-gradient px-4 py-2 font-semibold text-white"
              >
                Apply on {sourceLabel}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
          <p className="mt-3 text-xs text-navy-light/50">
            CareerLens doesn&apos;t submit applications on your behalf — this opens the original
            listing so you apply directly.
          </p>
        </div>
      </div>
    </main>
  );
}
