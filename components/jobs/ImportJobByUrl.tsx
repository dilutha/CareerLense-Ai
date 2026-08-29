"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { importJobByUrl } from "@/lib/jobs/actions";

/**
 * Manual fallback for LinkedIn, XpressJobs, ikman, or any company page —
 * sources CareerLens doesn't (and, for LinkedIn, won't) crawl
 * automatically. Only succeeds when the page publishes schema.org
 * JobPosting data and its robots.txt permits the fetch; otherwise
 * suggests pasting the description in chat instead, which is a real,
 * already-supported analysis path.
 */
export function ImportJobByUrl() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "error" | "hint"; text: string } | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setMessage(null);

    startTransition(async () => {
      const result = await importJobByUrl(url.trim());
      if (result.success && result.jobId) {
        router.push(`/jobs/${result.jobId}`);
        return;
      }
      setMessage({
        kind: "hint",
        text:
          (result.error ?? "Couldn't import that job.") +
          " You can also paste the job description directly in chat — CareerLens can analyze it that way instead.",
      });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-2xl border border-navy/10 bg-white p-4 text-sm sm:flex-row sm:items-center"
    >
      <label htmlFor="import-url" className="flex items-center gap-1.5 text-navy-light/70 sm:shrink-0">
        <Link2 className="h-4 w-4" aria-hidden="true" />
        Got a job URL? (LinkedIn, company page, etc.)
      </label>
      <input
        id="import-url"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        className="flex-1 rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending || !url.trim()}
        className="flex items-center justify-center gap-2 rounded-full bg-navy px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Import
      </button>
      {message && (
        <p className="w-full text-xs text-navy-light/60 sm:basis-full">{message.text}</p>
      )}
    </form>
  );
}
