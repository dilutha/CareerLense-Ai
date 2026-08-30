import type { MatchScoreBreakdown } from "@/lib/jobs/summary";

const DIMENSION_LABELS: Record<keyof MatchScoreBreakdown, string> = {
  skills: "Skills",
  role: "Role",
  experience: "Experience",
  education: "Education",
  location: "Location",
  keywords: "Keywords",
};

/** strong (✓) / partial (△) / weak (✗) — same real sub-scores already computed by lib/jobs/match.ts, never a second calculation (Part 15). */
function tier(score: number): { icon: string; className: string } {
  if (score >= 70) return { icon: "✓", className: "text-emerald-600" };
  if (score >= 40) return { icon: "△", className: "text-amber-600" };
  return { icon: "✗", className: "text-navy-light/50" };
}

export function MatchBreakdown({ breakdown }: { breakdown: MatchScoreBreakdown }) {
  const entries = (Object.keys(DIMENSION_LABELS) as (keyof MatchScoreBreakdown)[])
    .map((key) => ({ key, score: breakdown[key] }))
    .filter((e): e is { key: keyof MatchScoreBreakdown; score: number } => e.score !== null);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-light/70">
      {entries.map(({ key, score }) => {
        const { icon, className } = tier(score);
        return (
          <span key={key} className="flex items-center gap-1">
            <span className={className}>{icon}</span>
            {DIMENSION_LABELS[key]}
          </span>
        );
      })}
    </div>
  );
}
