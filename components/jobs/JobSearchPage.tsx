"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { AlertCircle, ExternalLink, Loader2, Search } from "lucide-react";
import { searchJobsForCurrentUser } from "@/lib/jobs/actions";
import type { SourceRegistryEntry } from "@/lib/jobs/providers/types";
import { toJobResultSummary, type JobResultSummary } from "@/lib/jobs/summary";
import { ImportJobByUrl } from "./ImportJobByUrl";
import { JobResultList } from "./JobResultList";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none";

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "internship", label: "Internship" },
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
];

const FRESHNESS_OPTIONS = ["Any", "Fresh", "Recent", "Older"] as const;

export function JobSearchPage({
  savedJobIds,
  sourceRegistry,
}: {
  savedJobIds: string[];
  sourceRegistry: SourceRegistryEntry[];
}) {
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [minMatchScore, setMinMatchScore] = useState(0);
  const [freshness, setFreshness] = useState<(typeof FRESHNESS_OPTIONS)[number]>("Any");
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(sourceRegistry.filter((s) => s.automatedSearch).map((s) => s.key))
  );
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<JobResultSummary[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"match" | "newest">("match");

  const automatedSources = sourceRegistry.filter((s) => s.automatedSearch);
  const externalSources = sourceRegistry.filter((s) => !s.automatedSearch);

  function toggleSource(key: string) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const response = await searchJobsForCurrentUser({
        role: role.trim() || null,
        location: location.trim() || null,
        workMode: workMode || null,
        keywords: [],
      });

      if ("error" in response) {
        setError(response.error);
        return;
      }

      const summaries = response.results.map((r) => toJobResultSummary(r, r.job.source === "demo"));
      setResults(summaries);

      const unavailable = response.providerStatus.filter((p) => p.status !== "ok");
      if (unavailable.length > 0) {
        setNotice(`Some sources couldn't be checked right now: ${unavailable.map((p) => p.label).join(", ")}.`);
      }
    });
  }

  const filtered = useMemo(() => {
    if (!results) return null;
    return results.filter((job) => {
      if (job.matchScore < minMatchScore) return false;
      if (employmentType && job.employmentType !== employmentType) return false;
      if (freshness !== "Any" && job.freshness !== freshness) return false;
      if (!job.isDemo && !activeSources.has(job.source)) return false;
      return true;
    });
  }, [results, minMatchScore, employmentType, freshness, activeSources]);

  const sorted = filtered
    ? [...filtered].sort((a, b) =>
        sort === "match"
          ? b.matchScore - a.matchScore
          : new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime()
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="job-role" className="text-xs font-medium text-navy-light/70">
              Role
            </label>
            <input
              id="job-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Data Analyst"
              className={inputClass}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="job-location" className="text-xs font-medium text-navy-light/70">
              Location
            </label>
            <input
              id="job-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Colombo"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="job-mode" className="text-xs font-medium text-navy-light/70">
              Work mode
            </label>
            <select
              id="job-mode"
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value)}
              className={inputClass}
            >
              <option value="">Any</option>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="job-type" className="text-xs font-medium text-navy-light/70">
              Type
            </label>
            <select
              id="job-type"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className={inputClass}
            >
              {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-navy/10 pt-3 text-xs text-navy-light/70">
          <span className="font-medium text-navy-light/50">Sources:</span>
          {automatedSources.map((source) => (
            <label key={source.key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={activeSources.has(source.key)}
                onChange={() => toggleSource(source.key)}
                className="h-3.5 w-3.5 rounded border-navy/20 text-ocean focus:ring-ocean"
              />
              {source.name}
            </label>
          ))}
          {externalSources.map((source) => (
            <span key={source.key} title={source.statusReason} className="text-navy-light/40">
              {source.name} — external search
            </span>
          ))}
        </div>
      </form>

      <ImportJobByUrl />

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      {notice && !error && (
        <p className="text-sm text-navy-light/60">{notice}</p>
      )}

      {sorted && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-navy-light/70">
              {sorted.length} {sorted.length === 1 ? "result" : "results"}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5 text-navy-light/60">
                Min match
                <select
                  value={minMatchScore}
                  onChange={(e) => setMinMatchScore(Number(e.target.value))}
                  className="rounded-lg border border-navy/10 bg-white px-2 py-1"
                >
                  <option value={0}>Any</option>
                  <option value={60}>60%+</option>
                  <option value={75}>75%+</option>
                  <option value={90}>90%+</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-navy-light/60">
                Freshness
                <select
                  value={freshness}
                  onChange={(e) => setFreshness(e.target.value as typeof freshness)}
                  className="rounded-lg border border-navy/10 bg-white px-2 py-1"
                >
                  {FRESHNESS_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="job-sort" className="flex items-center gap-1.5 text-navy-light/60">
                Sort
                <select
                  id="job-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "match" | "newest")}
                  className="rounded-lg border border-navy/10 bg-white px-2 py-1"
                >
                  <option value="match">Best match</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
          </div>
          <JobResultList
            jobs={sorted}
            savedJobIds={savedJobIds}
            emptyMessage="Machan, danata strong match ekak hambune ne. Try loosening a filter — broader location, internship + entry-level, or a related role."
          />
          {externalSources.length > 0 && (
            <div className="flex flex-wrap gap-3 rounded-2xl border border-navy/10 bg-white p-4 text-xs text-navy-light/60">
              {externalSources.map((source) => (
                <a
                  key={source.key}
                  href={
                    source.key === "linkedin"
                      ? "https://www.linkedin.com/jobs/"
                      : source.key === "xpressjobs"
                        ? "https://xpress.jobs/"
                        : "https://ikman.lk/jobs"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium text-navy hover:text-ocean"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Search {source.name} externally
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
