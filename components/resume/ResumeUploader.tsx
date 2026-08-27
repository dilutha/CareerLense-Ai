"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, FileUp, Loader2 } from "lucide-react";
import { processResume, uploadResume } from "@/lib/resume/actions";

type UploadStage = "idle" | "uploading" | "reading" | "analyzing" | "error";

const STAGE_LABEL: Record<Exclude<UploadStage, "idle" | "error">, string> = {
  uploading: "Uploading...",
  reading: "Reading your CV...",
  analyzing: "Analysing...",
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function ResumeUploader() {
  const router = useRouter();
  const [stage, setStage] = useState<UploadStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isDocx =
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx");

    if (!isPdf && !isDocx) {
      setError("Only PDF or DOCX files are supported.");
      setStage("error");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("That file is too big — max 10 MB.");
      setStage("error");
      return;
    }

    setStage("uploading");
    const formData = new FormData();
    formData.set("file", file);

    const uploadResult = await uploadResume(formData);
    if (!uploadResult.success || !uploadResult.resumeId) {
      setError(uploadResult.error ?? "Couldn't upload that file.");
      setStage("error");
      return;
    }

    setStage("reading");
    // processResume covers both text extraction and Gemini analysis —
    // shown as one "reading/analysing" stage in the UI since there's no
    // intermediate signal from the server action to split on.
    setTimeout(() => setStage("analyzing"), 1200);

    const processResult = await processResume(uploadResult.resumeId);
    if (!processResult.success) {
      setError(processResult.error ?? "Something went wrong while reading your CV.");
      setStage("error");
      return;
    }

    setStage("idle");
    router.refresh();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const busy = stage === "uploading" || stage === "reading" || stage === "analyzing";

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragActive ? "border-ocean bg-foam" : "border-navy/15 bg-foam/50"
        }`}
      >
        {busy ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2"
          >
            <Loader2 className="h-6 w-6 animate-spin text-ocean" aria-hidden="true" />
            <p className="text-sm font-medium text-navy" aria-live="polite">
              {STAGE_LABEL[stage]}
            </p>
          </motion.div>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sea-gradient text-white">
              <FileUp className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-navy">
              Got a CV? Drop it here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-ocean underline-offset-2 hover:underline"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-navy-light/60">PDF or DOCX · Max 10 MB</p>
          </>
        )}

        <label htmlFor="resume-file-input" className="sr-only">
          Upload your CV
        </label>
        <input
          id="resume-file-input"
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}
