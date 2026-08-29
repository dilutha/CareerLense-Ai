import Link from "next/link";
import type { ClassifiedSkill, MarketSkillReport } from "@/lib/career/market-skills";
import type { PrioritizedSkillGap } from "@/lib/career/skill-gap-priority";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-navy/5 text-navy-light/70",
};

function SkillGroup({ title, skills, style }: { title: string; skills: ClassifiedSkill[]; style: string }) {
  if (skills.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <span key={s.skill} className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
            {s.skill} · {s.demandPercent}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function SkillGapDashboard({
  targetRole,
  marketReport,
  classified,
  prioritized,
}: {
  targetRole: string | null;
  marketReport: MarketSkillReport | null;
  classified: ClassifiedSkill[];
  prioritized: PrioritizedSkillGap[];
}) {
  if (!targetRole) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
        Set a target role in{" "}
        <Link href="/profile" className="font-medium text-ocean hover:text-navy">
          your profile
        </Link>{" "}
        so CareerLens can compare your skills against real job demand.
      </div>
    );
  }

  if (!marketReport || marketReport.relevantJobCount === 0) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
        Machan, danata &quot;{targetRole}&quot; walata match wena vacancies godak nathi nisa reliable skill
        data ekak denna bari. Search for some jobs on{" "}
        <Link href="/jobs" className="font-medium text-ocean hover:text-navy">
          /jobs
        </Link>{" "}
        first.
      </div>
    );
  }

  const strong = classified.filter((s) => s.classification === "strong");
  const developing = classified.filter((s) => s.classification === "developing");
  const missing = classified.filter((s) => s.classification === "missing");
  const emerging = classified.filter((s) => s.classification === "emerging");

  return (
    <div className="flex flex-col gap-5">
      {marketReport.smallSample && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Based on the limited vacancies currently available ({marketReport.relevantJobCount} jobs) — take
          these percentages as a rough signal, not a precise market study.
        </p>
      )}

      <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="mb-1 text-sm text-navy-light/70">
          Target role: <span className="font-semibold text-navy">{targetRole}</span>
        </p>
        <p className="mb-4 text-xs text-navy-light/50">
          Based on {marketReport.relevantJobCount} matched job{marketReport.relevantJobCount === 1 ? "" : "s"} — real
          stored data, never invented percentages.
        </p>
        <div className="flex flex-col gap-4">
          <SkillGroup title="Strong" skills={strong} style="bg-emerald-50 text-emerald-700" />
          <SkillGroup title="Developing" skills={developing} style="bg-amber-50 text-amber-700" />
          <SkillGroup title="Missing" skills={missing} style="bg-red-50 text-red-700" />
          <SkillGroup title="Emerging" skills={emerging} style="bg-navy/5 text-navy-light/70" />
        </div>
      </div>

      {prioritized.length > 0 && (
        <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">Priority to learn next</p>
            <Link
              href="/career/roadmap"
              className="text-sm font-medium text-ocean hover:text-navy"
            >
              Build a roadmap →
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {prioritized.slice(0, 6).map((gap, i) => (
              <li key={gap.skill} className="flex items-start gap-3">
                <span className="mt-0.5 text-sm font-semibold text-navy-light/40">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-navy">{gap.skill}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${PRIORITY_STYLES[gap.priority]}`}>
                      {gap.priority}
                    </span>
                  </div>
                  <p className="text-xs text-navy-light/60">{gap.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
