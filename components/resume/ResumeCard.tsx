"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, FileText, Loader2, Star, Trash2 } from "lucide-react";
import { deleteResume, getResumeSignedUrl, setDefaultResume } from "@/lib/resume/actions";
import type { ResumeWithAnalysis } from "@/lib/resume/types";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  processing: "Analysing...",
  ready: "Ready",
  failed: "Failed",
};

export function ResumeCard({ item }: { item: ResumeWithAnalysis }) {
  const { resume, analysis } = item;
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleViewOriginal() {
    startTransition(async () => {
      const result = await getResumeSignedUrl(resume.id);
      if (!result.success || !result.url) {
        setError(result.error ?? "Couldn't open that file.");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteResume(resume.id);
      if (!result.success) {
        setError(result.error ?? "Couldn't delete that resume.");
        setConfirmingDelete(false);
      }
    });
  }

  function handleSetDefault() {
    startTransition(async () => {
      await setDefaultResume(resume.id);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foam text-ocean">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="flex items-center gap-1.5 font-medium text-navy">
              {resume.name}
              {resume.is_default && (
                <Star className="h-3.5 w-3.5 fill-ocean text-ocean" aria-label="Default resume" />
              )}
            </p>
            <p className="text-xs text-navy-light/60">
              {STATUS_LABEL[resume.status] ?? resume.status}
              {resume.status === "ready" && analysis?.overall_score != null && (
                <> · Score {analysis.overall_score}/100</>
              )}
            </p>
          </div>
        </div>
        {resume.status === "processing" && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ocean" aria-hidden="true" />
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-3 text-sm">
        {resume.status === "ready" && (
          <Link href={`/resume/${resume.id}`} className="font-medium text-ocean hover:text-navy">
            View Analysis
          </Link>
        )}
        <button
          type="button"
          onClick={handleViewOriginal}
          disabled={pending}
          className="flex items-center gap-1 font-medium text-navy-light/70 hover:text-navy disabled:opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Original file
        </button>
        {!resume.is_default && resume.status === "ready" && (
          <button
            type="button"
            onClick={handleSetDefault}
            disabled={pending}
            className="font-medium text-navy-light/70 hover:text-navy disabled:opacity-50"
          >
            Set as default
          </button>
        )}

        <div className="ml-auto">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-navy-light/60">Delete this CV?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="font-medium text-red-600 hover:text-red-700"
              >
                {pending ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="font-medium text-navy-light/60 hover:text-navy"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete resume"
              className="flex h-8 w-8 items-center justify-center rounded-full text-navy-light/50 hover:bg-foam hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
