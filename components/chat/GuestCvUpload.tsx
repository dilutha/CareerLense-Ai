"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud } from "lucide-react";

export interface GuestCandidate {
  skills: string[];
  targetRole: string | null;
}

/**
 * Guest-only "temporary processing" CV upload (Part 7) — posts to
 * /api/guest/parse-resume, which extracts + parses the file without ever
 * touching Supabase Storage or a database table. The result lives only in
 * the parent's React state for this browser session.
 */
export function GuestCvUpload({ onParsed }: { onParsed: (candidate: GuestCandidate, skillCount: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [skillCount, setSkillCount] = useState(0);

  async function handleFile(file: File) {
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/guest/parse-resume", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setError(typeof data?.error === "string" ? data.error : "Couldn't read that CV right now.");
        return;
      }

      const skills: string[] = Array.isArray(data.skills) ? data.skills : [];
      onParsed({ skills, targetRole: typeof data.targetRole === "string" ? data.targetRole : null }, skills.length);
      setSkillCount(skills.length);
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Couldn't read that CV right now. You can tell me about your experience in chat instead.");
    }
  }

  if (status === "done") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-navy-light/60">
        <FileText className="h-3.5 w-3.5 text-ocean" aria-hidden="true" />
        Found {skillCount} skill{skillCount === 1 ? "" : "s"} from your CV — I&apos;ll use this to match jobs.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="flex items-center gap-1.5 rounded-full border border-navy/10 bg-white px-4 py-2 text-xs font-medium text-navy-light/80 shadow-sm hover:border-ocean/30 hover:text-navy disabled:opacity-60"
      >
        {status === "uploading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {status === "uploading" ? "Reading your CV..." : "Upload your CV (optional)"}
      </button>
      {error && <p className="text-xs text-amber-700">{error}</p>}
    </div>
  );
}
