import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { requireUser } from "@/lib/auth/require-user";
import { computeAnalyticsSummary } from "@/lib/applications/analytics-summary";
import { getApplicationsForUser } from "@/lib/applications/get-applications";
import { computeResumePerformance } from "@/lib/applications/resume-performance";
import { computeSourcePerformance } from "@/lib/applications/source-performance";
import { computeApplicationStats } from "@/lib/applications/stats";
import type { ApplicationStatusHistoryRow } from "@/lib/applications/types";
import { getResumesForUser } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AnalyticsPage() {
  const user = await requireUser("/analytics");
  const supabase = await createServerSupabaseClient();

  const [applications, resumes, { data: history }] = await Promise.all([
    getApplicationsForUser(user.id),
    getResumesForUser(user.id),
    supabase.from("application_status_history").select("*").eq("profile_id", user.id),
  ]);

  const historyByApplication = new Map<string, ApplicationStatusHistoryRow[]>();
  for (const row of (history ?? []) as ApplicationStatusHistoryRow[]) {
    const list = historyByApplication.get(row.application_id) ?? [];
    list.push(row);
    historyByApplication.set(row.application_id, list);
  }

  const applicationRows = applications.map((a) => a.application);
  const jobsById = new Map(applications.map((a) => [a.job.id, a.job]));
  const matchesByJob = new Map(
    applications.filter((a) => a.match).map((a) => [a.job.id, a.match!])
  );

  const stats = computeApplicationStats(applicationRows, historyByApplication);
  const summary = computeAnalyticsSummary(applications.map((a) => a.job), matchesByJob);
  const sourcePerformance = computeSourcePerformance(applicationRows, jobsById);

  const documentIds = applicationRows.map((a) => a.application_document_id).filter((id): id is string => id !== null);
  let documentToResumeId = new Map<string, string>();
  if (documentIds.length > 0) {
    const { data: docs } = await supabase
      .from("application_documents")
      .select("id, source_resume_id")
      .in("id", documentIds);
    documentToResumeId = new Map(
      ((docs ?? []) as { id: string; source_resume_id: string }[]).map((d) => [d.id, d.source_resume_id])
    );
  }
  const resumeNames = new Map(resumes.map((r) => [r.resume.id, r.resume.name]));
  const resumePerformance = computeResumePerformance(applicationRows, documentToResumeId, resumeNames);

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link
          href="/career"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to career dashboard
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">Career Analytics</h1>
          <p className="text-sm text-navy-light/70">
            Real numbers from your own application history — never invented.
          </p>
        </div>

        <AnalyticsDashboard
          stats={stats}
          summary={summary}
          sourcePerformance={sourcePerformance}
          resumePerformance={resumePerformance}
          totalApplications={applicationRows.length}
        />
      </div>
    </main>
  );
}
