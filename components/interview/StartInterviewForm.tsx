"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Mic, Play } from "lucide-react";
import { startAdaptiveInterviewSession, startInterviewSession } from "@/lib/interview/actions";

export function StartInterviewForm({
  savedJobs,
}: {
  savedJobs: { id: string; title: string; company: string | null }[];
}) {
  const router = useRouter();
  const [jobId, setJobId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart(event: FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await startInterviewSession(jobId || undefined);
      if (!result.success || !result.sessionId) {
        setError(result.error ?? "Couldn't start the interview.");
        return;
      }
      router.push(`/interview/${result.sessionId}`);
    });
  }

  function handleStartVoice() {
    setError(null);

    startTransition(async () => {
      const result = await startAdaptiveInterviewSession(jobId || undefined);
      if (!result.success || !result.sessionId) {
        setError(result.error ?? "Couldn't start the interview.");
        return;
      }
      router.push(`/interview/${result.sessionId}?voice=1`);
    });
  }

  return (
    <form onSubmit={handleStart} className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <label htmlFor="interview-job" className="text-xs font-medium text-navy-light/70">
        Practice for a specific saved job (optional)
      </label>
      <select
        id="interview-job"
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        className="w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy focus:border-ocean/40 focus:outline-none"
      >
        <option value="">General practice (no specific job)</option>
        {savedJobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.title}
            {job.company ? ` at ${job.company}` : ""}
          </option>
        ))}
      </select>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex w-fit items-center justify-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          💬 Text Interview
        </button>
        <button
          type="button"
          onClick={handleStartVoice}
          disabled={pending}
          className="flex w-fit items-center justify-center gap-2 rounded-full border border-navy/10 bg-white px-6 py-2.5 text-sm font-semibold text-navy shadow-sm disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4 text-ocean" aria-hidden="true" />}
          🎙 Start Voice Interview
        </button>
      </div>
    </form>
  );
}
