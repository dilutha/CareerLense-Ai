"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { analyzePortfolio, generatePortfolioContentAction } from "@/lib/portfolio/actions";
import type { PortfolioAnalysisRow, PortfolioGeneratedContentRow } from "@/lib/portfolio/types";
import type { PortfolioContentSection } from "@/lib/portfolio/schemas";
import { FindingsList } from "./FindingsList";

const CATEGORY_LABELS: Record<string, string> = {
  career_positioning: "Career Positioning",
  projects: "Projects",
  technical_evidence: "Technical Evidence",
  content_quality: "Content Quality",
  recruiter_readability: "Recruiter Readability",
  seo: "SEO",
};

const CONTENT_SECTIONS: { value: PortfolioContentSection; label: string }[] = [
  { value: "hero", label: "Hero headline" },
  { value: "about", label: "About section" },
  { value: "project", label: "Project description" },
  { value: "skills", label: "Skills section" },
  { value: "summary", label: "Career summary" },
  { value: "cta", label: "Contact CTA" },
];

export function PortfolioDashboard({
  analysis,
  generatedContent,
}: {
  analysis: PortfolioAnalysisRow | null;
  generatedContent: PortfolioGeneratedContentRow[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState(analysis?.url ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ section: string; content: string } | null>(null);

  function handleAnalyze(event: FormEvent, forceRefresh = false) {
    event.preventDefault();
    if (!url.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await analyzePortfolio(url.trim(), forceRefresh);
      if (!result.success) {
        setError(result.error ?? "Couldn't analyze that portfolio.");
        return;
      }
      router.refresh();
    });
  }

  function handleGenerate(section: PortfolioContentSection) {
    setError(null);
    startTransition(async () => {
      const result = await generatePortfolioContentAction(section, analysis?.id);
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
        onSubmit={(e) => handleAnalyze(e)}
        className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="portfolio-url" className="text-xs font-medium text-navy-light/70">
            Portfolio URL
          </label>
          <input
            id="portfolio-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourname.dev"
            className="w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending || !url.trim()}
          className="flex items-center justify-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          Analyze
        </button>
        {analysis && (
          <button
            type="button"
            onClick={(e) => handleAnalyze(e, true)}
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-full border border-navy/10 px-4 py-2.5 text-sm font-medium text-navy hover:bg-foam disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        )}
      </form>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!analysis && !pending && (
        <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center text-sm text-navy-light/70">
          Paste your portfolio URL above and I&apos;ll check first impression, projects, SEO, and
          recruiter readability.
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
            <p className="mb-3 text-sm font-semibold text-navy">Findings & recommendations</p>
            <FindingsList findings={analysis.findings} />
          </div>

          <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-navy">Generate content</p>
            <p className="mb-4 text-xs text-navy-light/50">
              Grounded only in your actual profile + CV — never invents skills, projects, or metrics.
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
                  {generatedContent.slice(0, 5).map((c) => (
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
