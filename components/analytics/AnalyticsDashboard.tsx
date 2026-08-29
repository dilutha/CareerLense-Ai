import Link from "next/link";
import type { AnalyticsSummary } from "@/lib/applications/analytics-summary";
import type { ResumePerformanceResult } from "@/lib/applications/resume-performance";
import type { SourcePerformanceEntry } from "@/lib/applications/source-performance";
import type { ApplicationStats } from "@/lib/applications/stats";

const MIN_SAMPLE_FOR_CONCLUSIONS = 5;

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-semibold text-navy">{value}</p>
      <p className="text-xs text-navy-light/60">{label}</p>
    </div>
  );
}

export function AnalyticsDashboard({
  stats,
  summary,
  sourcePerformance,
  resumePerformance,
  totalApplications,
}: {
  stats: ApplicationStats;
  summary: AnalyticsSummary;
  sourcePerformance: SourcePerformanceEntry[];
  resumePerformance: ResumePerformanceResult;
  totalApplications: number;
}) {
  if (totalApplications === 0) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
        No applications tracked yet — analytics will show up once you start tracking jobs on{" "}
        <Link href="/applications" className="font-medium text-ocean hover:text-navy">
          /applications
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard label="Applications" value={stats.total} />
        <MetricCard label="Interviews" value={stats.interviews} />
        <MetricCard label="Offers" value={stats.offers} />
        <MetricCard label="Interview rate" value={stats.interviewRate !== null ? `${stats.interviewRate}%` : "—"} />
        <MetricCard label="Offer rate" value={stats.offerRate !== null ? `${stats.offerRate}%` : "—"} />
        <MetricCard
          label="Average match score"
          value={summary.averageMatchScore !== null ? `${summary.averageMatchScore}%` : "—"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
            Top applied role
          </p>
          <p className="text-lg font-semibold text-navy">{summary.topAppliedRole ?? "Not enough data yet"}</p>
        </div>
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
            Top skill gap
          </p>
          <p className="text-lg font-semibold text-navy">{summary.topSkillGap ?? "None showing up yet"}</p>
        </div>
      </div>

      {sourcePerformance.length > 0 && (
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-navy">Source performance</p>
          {sourcePerformance.every((s) => s.applications < MIN_SAMPLE_FOR_CONCLUSIONS) && (
            <p className="mb-3 text-xs text-navy-light/50">
              Sample sizes are still small — treat these as early signals, not conclusions.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {sourcePerformance.map((s) => (
              <li key={s.sourceType} className="flex items-center justify-between rounded-xl bg-foam px-3.5 py-2.5 text-sm">
                <span className="text-navy">{s.sourceLabel}</span>
                <span className="text-navy-light/60">
                  {s.applications} application{s.applications === 1 ? "" : "s"} · {s.interviews} interview
                  {s.interviews === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resumePerformance.entries.length > 0 && (
        <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-navy">Resume performance</p>
          <p className="mb-3 text-xs text-navy-light/50">
            Observed association based on your application history — not a claim of causation.
          </p>
          <ul className="flex flex-col gap-2">
            {resumePerformance.entries.map((r) => (
              <li key={r.resumeId} className="flex items-center justify-between rounded-xl bg-foam px-3.5 py-2.5 text-sm">
                <span className="text-navy">{r.resumeName}</span>
                <span className="text-navy-light/60">
                  {r.applications} application{r.applications === 1 ? "" : "s"} · {r.interviews} interview
                  {r.interviews === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
          {resumePerformance.observation && (
            <p className="mt-3 border-t border-navy/10 pt-3 text-sm text-navy-light/70">
              {resumePerformance.observation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
