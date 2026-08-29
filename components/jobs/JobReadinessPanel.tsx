import type { JobReadiness } from "@/lib/career/get-job-readiness";

const ROWS: { key: keyof JobReadiness; label: string }[] = [
  { key: "cv", label: "CV" },
  { key: "portfolio", label: "Portfolio" },
  { key: "github", label: "GitHub" },
  { key: "skills", label: "Skills (this job)" },
  { key: "interview", label: "Interview" },
];

export function JobReadinessPanel({ readiness }: { readiness: JobReadiness }) {
  const hasAnyData = ROWS.some((r) => readiness[r.key] !== null);
  if (!hasAnyData) return null;

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-navy">Job Readiness</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ROWS.map(({ key, label }) => {
          const value = readiness[key];
          return (
            <div key={key} className="flex items-center justify-between rounded-xl bg-foam px-3.5 py-2 text-sm">
              <span className="text-navy-light/70">{label}</span>
              <span className={typeof value === "number" ? "font-semibold text-navy" : "text-navy-light/40"}>
                {typeof value === "number" ? `${value}%` : "Not evaluated"}
              </span>
            </div>
          );
        })}
      </div>
      {(readiness.strongest || readiness.weakest) && (
        <p className="mt-4 border-t border-navy/10 pt-3 text-sm text-navy-light/70">
          {readiness.strongest && (
            <>
              Main strength: <span className="font-medium text-navy">{readiness.strongest.label}</span>.{" "}
            </>
          )}
          {readiness.weakest && readiness.weakest.label !== readiness.strongest?.label && (
            <>
              Main weakness: <span className="font-medium text-navy">{readiness.weakest.label}</span>.
            </>
          )}
        </p>
      )}
    </div>
  );
}
