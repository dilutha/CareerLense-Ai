"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { trackApplication } from "@/lib/applications/actions";

export function TrackApplicationButton({ jobId, alreadyTracked }: { jobId: string; alreadyTracked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await trackApplication(jobId);
      if (result.success && result.applicationId) {
        router.push(`/applications/${result.applicationId}`);
      }
    });
  }

  if (alreadyTracked) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex w-fit items-center gap-2 rounded-full border border-navy/10 px-6 py-3 text-sm font-semibold text-navy hover:bg-foam disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
      Track Application
    </button>
  );
}
