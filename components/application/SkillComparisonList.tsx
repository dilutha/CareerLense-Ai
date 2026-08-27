import { CheckCircle2, Circle, HelpCircle, MinusCircle } from "lucide-react";
import type { SkillComparisonEntry, SkillMatchCategory } from "@/lib/application/schemas";

const CATEGORY_META: Record<
  SkillMatchCategory,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  strong_match: { label: "Strong match", icon: CheckCircle2, className: "text-emerald-600" },
  match: { label: "Match", icon: CheckCircle2, className: "text-ocean" },
  partial: { label: "Partial", icon: MinusCircle, className: "text-amber-500" },
  missing: { label: "Missing", icon: Circle, className: "text-navy-light/40" },
  insufficient_evidence: {
    label: "Not enough evidence",
    icon: HelpCircle,
    className: "text-navy-light/40",
  },
};

export function SkillComparisonList({ entries }: { entries: SkillComparisonEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-navy-light/60">No specific skills detected for this job yet.</p>;
  }

  const order: SkillMatchCategory[] = ["strong_match", "match", "partial", "missing", "insufficient_evidence"];
  const sorted = [...entries].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((entry, i) => {
        const meta = CATEGORY_META[entry.category];
        const Icon = meta.icon;
        return (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-navy">
              <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} aria-hidden="true" />
              {entry.skill}
              {entry.importance === "required" && (
                <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs text-navy-light/60">
                  required
                </span>
              )}
            </span>
            <span className={`text-xs ${meta.className}`}>
              {meta.label}
              {entry.relatedSkillFound && ` (you have ${entry.relatedSkillFound})`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
