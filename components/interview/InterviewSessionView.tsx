"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { completeInterviewSession, submitInterviewAnswer } from "@/lib/interview/actions";
import { computeSessionSummary } from "@/lib/interview/session-summary";
import type { InterviewExchangeRow, InterviewSessionRow } from "@/lib/interview/types";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  technical: "Technical",
  behavioral: "Behavioral",
  project: "Project",
  job_specific: "Job-specific",
};

export function InterviewSessionView({
  session,
  initialExchanges,
}: {
  session: InterviewSessionRow;
  initialExchanges: InterviewExchangeRow[];
}) {
  const router = useRouter();
  const [exchanges, setExchanges] = useState(initialExchanges);
  const [answer, setAnswer] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentIndex = exchanges.findIndex((e) => e.answer_text === null);
  const current = currentIndex >= 0 ? exchanges[currentIndex] : null;
  const summary = useMemo(() => computeSessionSummary(exchanges), [exchanges]);
  const allAnswered = currentIndex === -1;

  function handleSubmit() {
    if (!current || !answer.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await submitInterviewAnswer(current.id, answer.trim());
      if (!result.success) {
        setError(result.error ?? "Couldn't evaluate that.");
        return;
      }

      setExchanges((prev) =>
        prev.map((e) =>
          e.id === current.id
            ? {
                ...e,
                answer_text: answer.trim(),
                feedback: result.feedback ?? null,
                quality_score: result.qualityScore ?? null,
                score_breakdown: result.scoreBreakdown ?? null,
                answered_at: new Date().toISOString(),
              }
            : e
        )
      );
      setAnswer("");
    });
  }

  function handleFinish() {
    startTransition(async () => {
      await completeInterviewSession(session.id);
      router.refresh();
    });
  }

  const answeredCount = exchanges.filter((e) => e.answer_text !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
        <p className="text-sm text-navy-light/70">
          {answeredCount} / {exchanges.length} answered
        </p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            session.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {session.status === "completed" ? "Completed" : "In progress"}
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {current && (
        <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <span className="mb-2 inline-block rounded-full bg-foam px-2.5 py-1 text-xs font-semibold text-navy">
            {CATEGORY_LABELS[current.category] ?? current.category}
          </span>
          <p className="text-base font-medium text-navy">{current.question}</p>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            placeholder="Type your answer..."
            className="mt-4 w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2.5 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !answer.trim()}
            className="mt-3 flex items-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Submit answer
          </button>
        </div>
      )}

      {allAnswered && session.status === "in_progress" && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Finish & see summary
        </button>
      )}

      {(allAnswered || session.status === "completed") && (
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
      )}

      <div className="flex flex-col gap-3">
        {exchanges
          .filter((e) => e.answer_text !== null)
          .map((e) => (
            <div key={e.id} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="rounded-full bg-foam px-2.5 py-1 text-xs font-semibold text-navy">
                  {CATEGORY_LABELS[e.category] ?? e.category}
                </span>
                {e.quality_score !== null && (
                  <span className="text-sm font-semibold text-ocean">{e.quality_score}%</span>
                )}
              </div>
              <p className="text-sm font-medium text-navy">{e.question}</p>
              <p className="mt-2 text-sm text-navy-light/70">{e.answer_text}</p>
              {e.feedback && (
                <p className="mt-3 whitespace-pre-line border-t border-navy/10 pt-3 text-sm text-navy-light/80">
                  {e.feedback}
                </p>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
