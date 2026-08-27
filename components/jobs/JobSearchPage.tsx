"use client";

import { useState, useTransition, type FormEvent } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { searchJobsForCurrentUser } from "@/lib/jobs/actions";
import { toJobResultSummary, type JobResultSummary } from "@/lib/jobs/summary";
import { JobResultList } from "./JobResultList";

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-3.5 py-2 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none";

export function JobSearchPage({ savedJobIds }: { savedJobIds: string[] }) {
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<JobResultSummary[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"match" | "newest">("match");

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

      const isDemo = response.providerStatus.some((p) => p.isDemo);
      const summaries = response.results.map((r) => toJobResultSummary(r, isDemo));
      setResults(summaries);

      const unavailable = response.providerStatus.filter((p) => p.status !== "ok");
      if (unavailable.length > 0) {
        setNotice(`Some sources couldn't be checked right now: ${unavailable.map((p) => p.label).join(", ")}.`);
      }
    });
  }

  const sorted = results
    ? [...results].sort((a, b) =>
        sort === "match"
          ? b.matchScore - a.matchScore
          : new Date(b.postedAt ?? 0).getTime() - new Date(a.postedAt ?? 0).getTime()
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:flex-wrap"
      >
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
      </form>

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
          <div className="flex items-center justify-between">
            <p className="text-sm text-navy-light/70">
              {sorted.length} {sorted.length === 1 ? "result" : "results"}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="job-sort" className="text-navy-light/60">
                Sort
              </label>
              <select
                id="job-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as "match" | "newest")}
                className="rounded-lg border border-navy/10 bg-white px-2 py-1"
              >
                <option value="match">Best match</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>
          <JobResultList jobs={sorted} savedJobIds={savedJobIds} />
        </>
      )}
    </div>
  );
}
