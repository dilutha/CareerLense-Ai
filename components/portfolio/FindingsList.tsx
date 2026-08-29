const SEVERITY_STYLES: Record<string, { badge: string; icon: string }> = {
  critical: { badge: "bg-red-50 text-red-700", icon: "●" },
  high: { badge: "bg-amber-50 text-amber-700", icon: "▲" },
  medium: { badge: "bg-amber-50/60 text-amber-700/80", icon: "◆" },
  low: { badge: "bg-navy/5 text-navy-light/70", icon: "○" },
  good: { badge: "bg-emerald-50 text-emerald-700", icon: "✓" },
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "good"];

export interface FindingLike {
  label: string;
  severity: string;
  explanation: string;
  category?: string;
}

export function FindingsList({ findings }: { findings: FindingLike[] }) {
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-navy-light/60">No findings yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {sorted.map((finding, i) => {
        const style = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.low;
        return (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.badge}`}
            >
              {style.icon} {finding.severity}
            </span>
            <div>
              <p className="text-sm font-medium text-navy">{finding.label}</p>
              <p className="text-sm text-navy-light/70">{finding.explanation}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
