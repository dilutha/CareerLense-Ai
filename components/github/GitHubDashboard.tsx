"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { analyzeGitHub } from "@/lib/github/actions";
import type { GitHubAnalysisRow } from "@/lib/github/types";
import { FindingsList } from "@/components/portfolio/FindingsList";

const CATEGORY_LABELS: Record<string, string> = {
  profile_completeness: "Profile Completeness",
  repository_quality: "Repository Quality",
  career_relevance: "Career Relevance",
  documentation: "Documentation",
  activity: "Activity",
};

export function GitHubDashboard({ analysis }: { analysis: GitHubAnalysisRow | null }) {
  const router = useRouter();
  const [username, setUsername] = useState(analysis?.github_username ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze(event: FormEvent, forceRefresh = false) {
    event.preventDefault();
    if (!username.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await analyzeGitHub(username.trim(), forceRefresh);
      if (!result.success) {
        setError(result.error ?? "Couldn't analyze that GitHub profile.");
        return;
      }
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
          <label htmlFor="github-username" className="text-xs font-medium text-navy-light/70">
            GitHub username or profile URL
          </label>
          <input
            id="github-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. octocat or github.com/octocat"
            className="w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending || !username.trim()}
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
          Only your public profile and public, non-fork repositories are read — via GitHub&apos;s
          official API, never scraped, never private.
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

          {analysis.recommended_projects.length > 0 && (
            <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-navy">Project ideas to strengthen your evidence</p>
              <p className="mb-3 text-xs text-navy-light/50">
                Recommendations only — not claimed as already built.
              </p>
              <ul className="flex flex-col gap-3">
                {analysis.recommended_projects.map((p, i) => (
                  <li key={i} className="rounded-xl bg-foam p-3.5">
                    <p className="text-sm font-semibold text-navy">{p.title}</p>
                    <p className="text-sm text-navy-light/70">{p.reason}</p>
                    {p.skillsAddressed.length > 0 && (
                      <p className="mt-1 text-xs text-navy-light/50">
                        Addresses: {p.skillsAddressed.join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
