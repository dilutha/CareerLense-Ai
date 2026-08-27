"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Printer, RefreshCw } from "lucide-react";
import { generateCoverLetterForApplication } from "@/lib/application/actions";
import type { CoverLetterRow } from "@/lib/application/types";

export function CoverLetterPreview({
  documentId,
  letter,
  companyName,
  jobTitle,
}: {
  documentId: string;
  letter: CoverLetterRow;
  companyName: string | null;
  jobTitle: string;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateCoverLetterForApplication(documentId);
      if (!result.success) setError(result.error ?? "Couldn't regenerate the cover letter.");
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(letter.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Cover letter — version {letter.version_number}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-full border border-navy/10 px-3 py-1.5 text-xs font-medium text-navy hover:bg-foam"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full border border-navy/10 px-3 py-1.5 text-xs font-medium text-navy hover:bg-foam"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            Print
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full bg-sea-gradient px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Regenerate
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-amber-700">{error}</p>}

      <div
        data-printable
        className="rounded-2xl border border-navy/10 bg-white p-8 font-sans text-[13px] leading-relaxed text-neutral-900 print:rounded-none print:border-0 print:p-0"
      >
        <p className="mb-4 text-neutral-600">
          Re: {jobTitle}
          {companyName ? ` at ${companyName}` : ""}
        </p>
        <div className="whitespace-pre-line">{letter.content}</div>
      </div>
    </div>
  );
}
