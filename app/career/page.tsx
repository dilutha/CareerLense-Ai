import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BackLink } from "@/components/ui/BackLink";
import { requireUser } from "@/lib/auth/require-user";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getCareerReadinessSnapshot } from "@/lib/career/get-career";
import { computeCareerInsights } from "@/lib/career/insights";
import { classifyMarketSkills, computeMarketSkillDemand } from "@/lib/career/market-skills";
import { prioritizeSkillGaps } from "@/lib/career/skill-gap-priority";
import { CareerReadinessPanel } from "@/components/career/CareerReadinessPanel";
import { getApplicationsForUser } from "@/lib/applications/get-applications";
import { computeResumePerformance } from "@/lib/applications/resume-performance";
import { computeApplicationStats } from "@/lib/applications/stats";
import type { ApplicationStatusHistoryRow } from "@/lib/applications/types";
import { getDefaultResume, getResumesForUser } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UpcomingWidget } from "@/components/notifications/UpcomingWidget";
import { getUpcomingItems } from "@/lib/notifications/get-notifications";

export default async function CareerPage() {
  const user = await requireUser("/career");
  const supabase = await createServerSupabaseClient();

  const [snapshot, profile, applications, resume, resumes, { data: history }, upcoming] = await Promise.all([
    getCareerReadinessSnapshot(user.id),
    getCareerProfile(user.id),
    getApplicationsForUser(user.id),
    getDefaultResume(user.id),
    getResumesForUser(user.id),
    supabase.from("application_status_history").select("*").eq("profile_id", user.id),
    getUpcomingItems(user.id),
  ]);

  const targetRole = profile?.careerPreferences?.target_role ?? null;
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resume?.analysis?.skills.map((s) => s.name) ?? [];
  const candidateSkills = [...new Set([...profileSkills, ...resumeSkills])];

  const marketReport = targetRole ? await computeMarketSkillDemand(targetRole) : null;
  const topGap = marketReport
    ? prioritizeSkillGaps(classifyMarketSkills(marketReport, candidateSkills))[0] ?? null
    : null;

  const historyByApplication = new Map<string, ApplicationStatusHistoryRow[]>();
  for (const row of (history ?? []) as ApplicationStatusHistoryRow[]) {
    const list = historyByApplication.get(row.application_id) ?? [];
    list.push(row);
    historyByApplication.set(row.application_id, list);
  }
  const applicationRows = applications.map((a) => a.application);
  const stats = computeApplicationStats(applicationRows, historyByApplication);

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

  const insights = computeCareerInsights({ topSkillGap: topGap, applicationStats: stats, resumePerformance });

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <BackLink toChat />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              Good to see you, machan 👋
            </h1>
            <p className="text-sm text-navy-light/70">
              Everything CareerLens knows about you, in one place.
            </p>
          </div>
          <NotificationBell userId={user.id} />
        </div>

        <CareerReadinessPanel snapshot={snapshot} />

        <UpcomingWidget items={upcoming} />

        {insights.length > 0 && (
          <div className="flex flex-col gap-3">
            {insights.map((insight, i) => (
              <div key={i} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                <p className="text-sm text-navy">{insight.text}</p>
                <Link
                  href={insight.actionHref}
                  className="mt-2 flex w-fit items-center gap-1 text-sm font-medium text-ocean hover:text-navy"
                >
                  {insight.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">Applications</p>
            <Link href="/applications" className="text-sm font-medium text-ocean hover:text-navy">
              View all →
            </Link>
          </div>
          <p className="mt-2 text-sm text-navy-light/70">
            {stats.total} tracked · {stats.interviews} interview{stats.interviews === 1 ? "" : "s"} ·{" "}
            {stats.offers} offer{stats.offers === 1 ? "" : "s"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/jobs", label: "Find jobs", desc: "Real multi-source job discovery" },
            { href: "/applications", label: "Applications", desc: "Track your pipeline, statuses, follow-ups" },
            { href: "/career/skills", label: "Skill Gaps", desc: "Real market demand vs. your skills" },
            { href: "/career/roadmap", label: "Learning Roadmap", desc: "A personalized, prioritized plan" },
            { href: "/analytics", label: "Analytics", desc: "Response rates, resume performance" },
            { href: "/notifications", label: "Notifications", desc: "Follow-ups, interviews, deadlines" },
            { href: "/portfolio", label: "Portfolio", desc: "Score, findings, and content drafts" },
            { href: "/github", label: "GitHub", desc: "Public repos vs. your target role" },
            { href: "/linkedin", label: "LinkedIn", desc: "Paste your profile for feedback" },
            { href: "/interview", label: "Interview Coach", desc: "Job-specific mock interviews" },
            { href: "/jobs/saved", label: "Saved jobs", desc: "Bookmarked vacancies" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm transition-transform hover:scale-[1.01] hover:shadow-md"
            >
              <p className="font-semibold text-navy">{item.label}</p>
              <p className="text-sm text-navy-light/60">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
