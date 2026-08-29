import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CareerReadinessSnapshot } from "@/lib/career/get-career";

const COMPONENT_LABELS: Record<string, string> = {
  cv: "CV",
  portfolio: "Portfolio",
  skills: "Skills",
  projects: "Projects",
  linkedin: "LinkedIn",
  github: "GitHub",
  interview: "Interview",
  applications: "Applications",
};

const COMPONENT_LINKS: Record<string, string> = {
  cv: "/profile",
  portfolio: "/portfolio",
  skills: "/jobs",
  projects: "/portfolio",
  linkedin: "/linkedin",
  github: "/github",
  interview: "/interview",
  applications: "/applications",
};

export function CareerReadinessPanel({ snapshot }: { snapshot: CareerReadinessSnapshot }) {
  const { readiness, nextBestAction } = snapshot;

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Career Readiness</p>
        <span className="text-3xl font-semibold text-ocean">
          {readiness.overall !== null ? `${readiness.overall}%` : "—"}
        </span>
      </div>
      <p className="mb-4 text-xs text-navy-light/50">
        CareerLens readiness estimate — an internal estimate based on your CareerLens profile and
        activity, not a scientifically validated score.
      </p>

      {readiness.overall === null && (
        <p className="mb-4 text-sm text-navy-light/70">
          Nothing analyzed yet — start with your CV or portfolio below.
        </p>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {Object.entries(readiness.components).map(([key, score]) => (
          <Link
            key={key}
            href={COMPONENT_LINKS[key] ?? "/career"}
            className="flex items-center justify-between rounded-xl bg-foam px-3.5 py-2.5 text-sm hover:bg-foam/70"
          >
            <span className="text-navy-light/70">{COMPONENT_LABELS[key] ?? key}</span>
            <span className={score === null ? "text-navy-light/40" : "font-semibold text-navy"}>
              {score === null ? "Not analyzed" : `${score}%`}
            </span>
          </Link>
        ))}
      </div>

      {nextBestAction && (
        <div className="mt-5 rounded-xl bg-sea-gradient-soft p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-light/60">
            Next best action
          </p>
          <p className="text-sm text-navy">
            Focus on <span className="font-semibold">{nextBestAction.label}</span> next — {nextBestAction.reason}
          </p>
          <Link
            href={COMPONENT_LINKS[nextBestAction.component] ?? "/career"}
            className="mt-2 flex w-fit items-center gap-1 text-sm font-medium text-ocean hover:text-navy"
          >
            Go there
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
