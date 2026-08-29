"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink } from "lucide-react";
import { updateApplicationStatus } from "@/lib/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/schemas";
import type { ApplicationStats } from "@/lib/applications/stats";
import type { ApplicationWithJob } from "@/lib/applications/get-applications";

const STATUS_GROUP_ORDER: ApplicationStatus[] = [
  "saved",
  "interested",
  "preparing",
  "applied",
  "screening",
  "interview",
  "final_round",
  "offer",
  "rejected",
  "withdrawn",
  "closed",
];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold text-navy">{value}</p>
      <p className="text-xs text-navy-light/60">{label}</p>
    </div>
  );
}

function StatusSelect({ applicationId, current }: { applicationId: string; current: ApplicationStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(newStatus: ApplicationStatus) {
    startTransition(async () => {
      await updateApplicationStatus(applicationId, newStatus);
      router.refresh();
    });
  }

  return (
    <select
      value={current}
      onChange={(e) => handleChange(e.target.value as ApplicationStatus)}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      className="rounded-lg border border-navy/10 bg-foam px-2 py-1 text-xs font-medium text-navy disabled:opacity-50"
    >
      {APPLICATION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {APPLICATION_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function ApplicationsBoard({
  applications,
  stats,
  upcomingFollowUps,
}: {
  applications: ApplicationWithJob[];
  stats: ApplicationStats;
  upcomingFollowUps: ApplicationWithJob[];
}) {
  const grouped = new Map<ApplicationStatus, ApplicationWithJob[]>();
  for (const item of applications) {
    const list = grouped.get(item.application.status) ?? [];
    list.push(item);
    grouped.set(item.application.status, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Applications" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Interviews" value={stats.interviews} />
        <StatCard label="Offers" value={stats.offers} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Response rate" value={stats.responseRate !== null ? `${stats.responseRate}%` : "—"} />
        <StatCard label="Interview rate" value={stats.interviewRate !== null ? `${stats.interviewRate}%` : "—"} />
        <StatCard label="Offer rate" value={stats.offerRate !== null ? `${stats.offerRate}%` : "—"} />
      </div>

      {upcomingFollowUps.length > 0 && (
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-ocean" aria-hidden="true" />
            <p className="text-sm font-semibold text-navy">Upcoming follow-ups</p>
          </div>
          <ul className="flex flex-col gap-2">
            {upcomingFollowUps.map(({ application, job }) => (
              <li key={application.id}>
                <Link
                  href={`/applications/${application.id}`}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-foam"
                >
                  <span className="text-navy">
                    {job.title} at {job.company_name ?? "?"}
                  </span>
                  <span className="text-navy-light/60">{application.follow_up_date}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
          No applications tracked yet — save a job from{" "}
          <Link href="/jobs" className="font-medium text-ocean hover:text-navy">
            /jobs
          </Link>{" "}
          and track it here.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {STATUS_GROUP_ORDER.filter((status) => grouped.has(status)).map((status) => (
            <div key={status} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                {APPLICATION_STATUS_LABELS[status]} ({grouped.get(status)!.length})
              </p>
              <ul className="flex flex-col gap-2">
                {grouped.get(status)!.map(({ application, job, match }) => (
                  <li key={application.id}>
                    <Link
                      href={`/applications/${application.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-foam px-3.5 py-2.5 hover:bg-foam/70"
                    >
                      <div>
                        <p className="text-sm font-medium text-navy">{job.title}</p>
                        <p className="text-xs text-navy-light/60">
                          {job.company_name ?? "?"}
                          {match?.match_score != null ? ` · ${match.match_score}% match` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusSelect applicationId={application.id} current={application.status} />
                        <ExternalLink className="h-3.5 w-3.5 text-navy-light/40" aria-hidden="true" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
