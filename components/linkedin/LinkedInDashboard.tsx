"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { analyzeLinkedIn, generateLinkedInContentAction } from "@/lib/linkedin/actions";
import type { LinkedInAnalysisRow, LinkedInGeneratedContentRow } from "@/lib/linkedin/types";
import type { LinkedInContentSection } from "@/lib/linkedin/schemas";
import { FindingsList } from "@/components/portfolio/FindingsList";

const CATEGORY_LABELS: Record<string, string> = {
  headline: "Headline",
  about: "About",
  skills_experience: "Skills & Experience",
  positioning: "Positioning",
};

const CONTENT_SECTIONS: { value: LinkedInContentSection; label: string }[] = [
  { value: "headline_a", label: "Headline — Option A" },
  { value: "headline_b", label: "Headline — Option B" },
  { value: "headline_c", label: "Headline — Option C" },
  { value: "about", label: "About section" },
  { value: "skills", label: "Skills to feature" },
];

export function LinkedInDashboard({
  analysis,
  generatedContent,
}: {
  analysis: LinkedInAnalysisRow | null;
  generatedContent: LinkedInGeneratedContentRow[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ section: string; content: string } | null>(null);

  function handleAnalyze(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await analyzeLinkedIn(content.trim());
      if (!result.success) {
        setError(result.error ?? "Couldn't analyze that.");
        return;
      }
      router.refresh();
    });
  }

  function handleGenerate(section: LinkedInContentSection) {
    setError(null);
    startTransition(async () => {
      const result = await generateLinkedInContentAction(section, analysis?.id);
      if (!result.success || !result.content) {
        setError(result.error ?? "Couldn't generate that.");
        return;
      }
      setDraft({ section, content: result.content });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAnalyze}
        className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm"
      >
        <label htmlFor="linkedin-content" className="text-xs font-medium text-navy-light/70">
          Paste your headline, About section, skills, and experience
        </label>
        <textarea
          id="linkedin-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Data Science Student&#10;&#10;About: I'm a final-year..."
          className="w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2.5 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !content.trim()}
          className="flex w-fit items-center justify-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Analyze
        </button>
      </form>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {analysis && (
        <>
          <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-navy">Overall score</p>
              <span className="text-3xl font-semibold text-ocean">{analysis.overall_score ?? "—"}%</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(analysis.category_scores).map(([category, score]) => (
                <div key={category} className="flex items-center justify-between rounded-xl bg-foam px-3.5 py-2 text-sm">
                  <span className="text-navy-light/70">{CATEGORY_LABELS[category] ?? category}</span>
                  <span className="font-semibold text-navy">{score}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-navy">Findings</p>
            <FindingsList findings={analysis.findings} />
          </div>

          <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-navy">Generate drafts</p>
            <p className="mb-4 text-xs text-navy-light/50">
              Grounded only in your actual profile + CV. Copy and paste into LinkedIn yourself —
              CareerLens never edits your profile directly.
            </p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_SECTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => handleGenerate(s.value)}
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-full border border-navy/10 px-3.5 py-1.5 text-sm font-medium text-navy hover:bg-foam disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {s.label}
                </button>
              ))}
            </div>

            {draft && (
              <div className="mt-4 rounded-xl bg-foam p-4 text-sm text-navy">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                  {CONTENT_SECTIONS.find((s) => s.value === draft.section)?.label}
                </p>
                <p className="whitespace-pre-line">{draft.content}</p>
              </div>
            )}

            {generatedContent.length > 0 && (
              <div className="mt-4 border-t border-navy/10 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                  Previous drafts
                </p>
                <ul className="flex flex-col gap-2">
                  {generatedContent.slice(0, 6).map((c) => (
                    <li key={c.id} className="rounded-lg bg-foam/60 px-3 py-2 text-xs text-navy-light/70">
                      <span className="font-medium text-navy">{c.section}: </span>
                      {c.content.slice(0, 120)}
                      {c.content.length > 120 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
