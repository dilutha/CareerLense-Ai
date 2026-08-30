"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, ExternalLink, Loader2, MessageCircleQuestion, Sparkles } from "lucide-react";
import { explainJobMatch, saveJob, unsaveJob } from "@/lib/jobs/actions";
import type { JobResultSummary } from "@/lib/jobs/summary";
import type { MatchCategory } from "@/lib/jobs/types";
import { MatchBreakdown } from "./MatchBreakdown";

const MATCH_STYLES: Record<MatchCategory, string> = {
  excellent: "bg-sea-gradient text-white",
  good: "bg-ocean/10 text-ocean",
  potential: "bg-amber-100 text-amber-700",
  weak: "bg-navy/5 text-navy-light/70",
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  internship: "Internship",
  part_time: "Part-time",
  full_time: "Full-time",
  contract: "Contract",
  freelance: "Freelance",
  volunteer: "Volunteer",
  other: "Other",
};

const FRESHNESS_STYLES: Record<string, string> = {
  Fresh: "text-emerald-600",
  Recent: "text-navy-light/60",
  Older: "text-navy-light/40",
  Unknown: "text-navy-light/40",
};

export function JobCard({
  summary,
  initiallySaved = false,
  compact = false,
}: {
  summary: JobResultSummary;
  initiallySaved?: boolean;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  function toggleSave() {
    startTransition(async () => {
      const result = saved ? await unsaveJob(summary.id) : await saveJob(summary.id);
      if (result.success) setSaved((v) => !v);
    });
  }

  function handleExplain() {
    setExplaining(true);
    startTransition(async () => {
      const result = await explainJobMatch(summary.id);
      setExplanation(result.explanation ?? result.error ?? "Couldn't load an explanation.");
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-navy">{summary.title}</p>
          <p className="text-sm text-navy-light/70">
            {summary.company ?? "Company not specified"}
          </p>
          <p className="text-xs text-navy-light/50">
            {[
              summary.location ?? undefined,
              summary.workMode,
              summary.employmentType && EMPLOYMENT_LABEL[summary.employmentType],
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-xs text-navy-light/50">
            Source: {summary.isDemo ? "Demo Data" : summary.sourceName}
            {summary.freshness !== "Unknown" && (
              <span className={FRESHNESS_STYLES[summary.freshness]}> · {summary.freshness}</span>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${MATCH_STYLES[summary.matchCategory as MatchCategory] ?? MATCH_STYLES.weak}`}
        >
          {summary.matchScore}%
        </span>
      </div>

      {summary.isDemo && (
        <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          Demo data — no live job source configured yet
        </span>
      )}

      {!compact && <MatchBreakdown breakdown={summary.matchBreakdown} />}

      {!compact && (summary.matchedSkills.length > 0 || summary.missingRequiredSkills.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {summary.matchedSkills.slice(0, 5).map((skill) => (
            <span
              key={`m-${skill}`}
              className="rounded-full bg-foam px-2.5 py-1 text-xs font-medium text-navy"
            >
              ✓ {skill}
            </span>
          ))}
          {summary.missingRequiredSkills.slice(0, 3).map((skill) => (
            <span
              key={`g-${skill}`}
              className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
            >
              ⚠ {skill}
            </span>
          ))}
        </div>
      )}

      {explanation && <p className="text-sm text-navy-light/80">{explanation}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-3 text-sm">
        <Link href={`/jobs/${summary.id}`} className="font-medium text-ocean hover:text-navy">
          View Job
        </Link>
        <Link
          href={`/application/${summary.id}`}
          className="flex items-center gap-1 font-medium text-navy-light/70 hover:text-navy"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Tailor CV
        </Link>
        <a
          href={summary.applicationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-medium text-navy-light/70 hover:text-navy"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Apply
        </a>
        {!explanation && (
          <button
            type="button"
            onClick={handleExplain}
            disabled={explaining}
            className="flex items-center gap-1 font-medium text-navy-light/70 hover:text-navy disabled:opacity-50"
          >
            {explaining && pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Why does this match?
          </button>
        )}
        <button
          type="button"
          onClick={toggleSave}
          disabled={pending}
          aria-pressed={saved}
          className="ml-auto flex items-center gap-1 font-medium text-navy-light/70 hover:text-navy disabled:opacity-50"
        >
          {saved ? (
            <BookmarkCheck className="h-3.5 w-3.5 text-ocean" aria-hidden="true" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </motion.div>
  );
}
