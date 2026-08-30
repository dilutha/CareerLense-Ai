import { CheckCircle2 } from "lucide-react";
import { computeSessionSummary } from "@/lib/interview/session-summary";
import type { InterviewExchangeRow } from "@/lib/interview/types";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  technical: "Technical",
  behavioral: "Behavioral",
  project: "Project",
  job_specific: "Job-specific",
};

/** Shared by InterviewSessionView (text mode) and VoiceInterviewView (voice mode) — same deterministic rollup, same presentation either way. */
export function InterviewSummary({ exchanges }: { exchanges: InterviewExchangeRow[] }) {
  const summary = computeSessionSummary(exchanges);

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-navy">Preparation summary</p>
      </div>
      <p className="mb-4 text-xs text-navy-light/50">
        An Answer Quality Score — relevance, structure, clarity, technical accuracy, conciseness. Not a
        prediction of real interview or hiring success.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(summary)
          .filter(([key]) => key !== "overall")
          .map(([category, score]) => (
            <div key={category} className="flex items-center justify-between rounded-xl bg-foam px-3.5 py-2 text-sm">
              <span className="text-navy-light/70">{CATEGORY_LABELS[category] ?? category}</span>
              <span className="font-semibold text-navy">{score}%</span>
            </div>
          ))}
      </div>
      {summary.overall !== null && (
        <div className="mt-4 flex items-center justify-between border-t border-navy/10 pt-4">
          <span className="text-sm font-semibold text-navy">Overall</span>
          <span className="text-2xl font-semibold text-ocean">{summary.overall}%</span>
        </div>
      )}
    </div>
  );
}

export { CATEGORY_LABELS };
