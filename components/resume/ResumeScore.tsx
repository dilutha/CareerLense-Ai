import type { ResumeScoreBreakdown } from "@/lib/resume/types";

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  clarity: "Clarity",
  completeness: "Completeness",
};

export function ResumeScore({
  overall,
  breakdown,
}: {
  overall: number;
  breakdown: ResumeScoreBreakdown | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <span className="text-4xl font-semibold text-navy">{overall}</span>
        <span className="mb-1 text-sm text-navy-light/60">/ 100 · CareerLens Resume Score</span>
      </div>
      <p className="text-xs text-navy-light/50">
        An AI-based estimate, not an official ATS score.
      </p>

      {breakdown && (
        <div className="flex flex-col gap-2.5">
          {Object.entries(breakdown).map(([category, value]) => (
            <div key={category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-navy-light/80">
                  {CATEGORY_LABELS[category] ?? category}
                </span>
                <span className="font-medium text-navy">{value}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foam">
                <div
                  className="h-full rounded-full bg-sea-gradient"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
