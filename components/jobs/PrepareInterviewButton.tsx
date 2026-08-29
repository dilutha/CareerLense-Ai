"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic } from "lucide-react";
import { startInterviewSession } from "@/lib/interview/actions";

export function PrepareInterviewButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await startInterviewSession(jobId);
      if (result.success && result.sessionId) {
        router.push(`/interview/${result.sessionId}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex w-fit items-center gap-2 rounded-full border border-navy/10 px-6 py-3 text-sm font-semibold text-navy hover:bg-foam disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
      Prepare for Interview
    </button>
  );
}
