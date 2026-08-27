import type { KeywordComparisonEntry } from "@/lib/application/schemas";

const STATUS_STYLES: Record<KeywordComparisonEntry["status"], string> = {
  present: "bg-emerald-50 text-emerald-700",
  weak: "bg-amber-50 text-amber-700",
  missing: "bg-navy/5 text-navy-light/60",
};

export function KeywordComparisonList({ entries }: { entries: KeywordComparisonEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-navy-light/60">No keywords extracted for this job yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((entry, i) => (
        <span
          key={i}
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[entry.status]}`}
        >
          {entry.keyword}
        </span>
      ))}
    </div>
  );
}
