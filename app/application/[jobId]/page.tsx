import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";
import { ApplicationDashboard } from "@/components/application/ApplicationDashboard";
import { requireUser } from "@/lib/auth/require-user";
import { getApplicationBundle } from "@/lib/application/get-application";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getJobWithMatch } from "@/lib/jobs/get-jobs";
import { getResumesForUser } from "@/lib/resume/get-resumes";

export default async function ApplicationPage(props: PageProps<"/application/[jobId]">) {
  const { jobId } = await props.params;
  const user = await requireUser(`/application/${jobId}`);

  const [jobResult, resumes, bundle, profile] = await Promise.all([
    getJobWithMatch(user.id, jobId),
    getResumesForUser(user.id),
    getApplicationBundle(user.id, jobId),
    getCareerProfile(user.id),
  ]);

  if (!jobResult) notFound();

  const readyResumes = resumes.filter((r) => r.resume.status === "ready");

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14 print:bg-white print:py-0">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between print:hidden">
          <BackLink href={`/jobs/${jobId}`} label="Back to job" />
        </div>

        <div className="print:hidden">
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            Tailor my application
          </h1>
          <p className="text-sm text-navy-light/70">
            {jobResult.job.title}
            {jobResult.job.company_name ? ` at ${jobResult.job.company_name}` : ""}
            {jobResult.job.location ? ` · ${jobResult.job.location}` : ""}
            {jobResult.job.source === "demo" ? " · Demo data" : ""}
          </p>
        </div>

        <ApplicationDashboard
          job={jobResult.job}
          resumes={readyResumes}
          bundle={bundle}
          contactInfo={{
            fullName: profile?.profile.full_name ?? null,
            headline: profile?.profile.headline ?? null,
          }}
        />
      </div>
    </main>
  );
}
