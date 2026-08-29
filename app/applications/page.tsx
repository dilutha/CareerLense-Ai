import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ApplicationsBoard } from "@/components/applications/ApplicationsBoard";
import { requireUser } from "@/lib/auth/require-user";
import { getApplicationsForUser, getUpcomingFollowUps } from "@/lib/applications/get-applications";
import { computeApplicationStats } from "@/lib/applications/stats";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApplicationStatusHistoryRow } from "@/lib/applications/types";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export default async function ApplicationsPage() {
  const user = await requireUser("/applications");
  const supabase = await createServerSupabaseClient();

  const [applications, followUps, { data: history }] = await Promise.all([
    getApplicationsForUser(user.id),
    getUpcomingFollowUps(user.id),
    supabase.from("application_status_history").select("*").eq("profile_id", user.id),
  ]);

  const historyByApplication = new Map<string, ApplicationStatusHistoryRow[]>();
  for (const row of (history ?? []) as ApplicationStatusHistoryRow[]) {
    const list = historyByApplication.get(row.application_id) ?? [];
    list.push(row);
    historyByApplication.set(row.application_id, list);
  }
  const stats = computeApplicationStats(
    applications.map((a) => a.application),
    historyByApplication
  );

  return (
    <main className="min-h-dvh bg-sea-gradient-soft px-6 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Link
          href="/career"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to career dashboard
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              Applications
            </h1>
            <p className="text-sm text-navy-light/70">Track every job you&apos;re pursuing, in one pipeline.</p>
          </div>
          <NotificationBell userId={user.id} />
        </div>

        <ApplicationsBoard applications={applications} stats={stats} upcomingFollowUps={followUps} />
      </div>
    </main>
  );
}
