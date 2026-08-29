"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, Loader2, Sparkles } from "lucide-react";
import {
  generateCoverLetterForApplication,
  generateTailoredCv,
  getOrCreateApplication,
  runApplicationAnalysis,
  updateApplicationStatus,
} from "@/lib/application/actions";
import type { ApplicationBundle, ApplicationDocumentVersion, CoverLetterRow } from "@/lib/application/types";
import type { Job } from "@/lib/jobs/types";
import type { ResumeWithAnalysis } from "@/lib/resume/types";
import { CoverLetterPreview } from "./CoverLetterPreview";
import { KeywordComparisonList } from "./KeywordComparisonList";
import { SkillComparisonList } from "./SkillComparisonList";
import { TailoredCvPreview } from "./TailoredCvPreview";
import { VersionHistory } from "./VersionHistory";

export function ApplicationDashboard({
  job,
  resumes,
  bundle,
  contactInfo,
}: {
  job: Job;
  resumes: ResumeWithAnalysis[];
  bundle: ApplicationBundle;
  contactInfo: { fullName: string | null; headline: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState(
    bundle.document?.source_resume_id ?? resumes[0]?.resume.id ?? ""
  );
  const [selectedCv, setSelectedCv] = useState<ApplicationDocumentVersion | null>(bundle.latestCvVersion);
  const [selectedCoverLetter, setSelectedCoverLetter] = useState<CoverLetterRow | null>(
    bundle.latestCoverLetter
  );

  const documentId = bundle.document?.id ?? null;

  function handleStart() {
    if (!selectedResumeId) {
      setError("Machan, first upload a CV before we can tailor it.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const created = await getOrCreateApplication(job.id, selectedResumeId);
      if (!created.success || !created.documentId) {
        setError(created.error ?? "Couldn't start this application.");
        return;
      }
      const analysis = await runApplicationAnalysis(created.documentId);
      if (!analysis.success) {
        setError(analysis.error ?? "Couldn't analyze this application.");
        return;
      }
      router.refresh();
    });
  }

  function handleTailorCv() {
    if (!documentId) return;
    setError(null);
    startTransition(async () => {
      const result = await generateTailoredCv(documentId);
      if (!result.success) {
        setError(result.error ?? "Couldn't tailor your CV.");
        return;
      }
      router.refresh();
    });
  }

  function handleStatusChange(status: string) {
    if (!documentId) return;
    startTransition(async () => {
      const result = await updateApplicationStatus(
        documentId,
        status as "preparing" | "ready_to_apply" | "applied" | "interview" | "rejected" | "offer"
      );
      if (!result.success) {
        setError(result.error ?? "Couldn't update status.");
        return;
      }
      router.refresh();
    });
  }

  function handleCoverLetter() {
    if (!documentId) return;
    setError(null);
    startTransition(async () => {
      const result = await generateCoverLetterForApplication(documentId);
      if (!result.success) {
        setError(result.error ?? "Couldn't write your cover letter.");
        return;
      }
      router.refresh();
    });
  }

  if (resumes.length === 0) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center">
        <p className="text-navy">
          Machan, me CV eka tailor karanna mama oyage original CV eka one. Upload karala balamu.
        </p>
        <a href="/profile" className="mt-3 inline-block font-medium text-ocean hover:text-navy">
          Upload your CV →
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-5">
        {!bundle.analysis ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-navy">Select a resume to tailor</p>
            <div className="flex flex-col gap-2">
              {resumes.map((r) => (
                <label
                  key={r.resume.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                    selectedResumeId === r.resume.id
                      ? "border-ocean bg-foam"
                      : "border-navy/10 hover:border-ocean/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="resume"
                    checked={selectedResumeId === r.resume.id}
                    onChange={() => setSelectedResumeId(r.resume.id)}
                    className="h-4 w-4 text-ocean focus:ring-ocean"
                  />
                  <span className="text-navy">{r.resume.name}</span>
                  {r.analysis?.overall_score != null && (
                    <span className="ml-auto text-xs text-navy-light/60">
                      Score {r.analysis.overall_score}/100
                    </span>
                  )}
                </label>
              ))}
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleStart}
              disabled={pending}
              className="flex w-fit items-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Analyze against this job
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 print:hidden">
              <label htmlFor="application-status" className="text-xs font-medium text-navy-light/60">
                Application status
              </label>
              <select
                id="application-status"
                value={bundle.document?.application_status ?? "preparing"}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={pending}
                className="rounded-lg border border-navy/10 bg-white px-2.5 py-1.5 text-sm text-navy"
              >
                <option value="preparing">Preparing</option>
                <option value="ready_to_apply">Ready to apply</option>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="rejected">Rejected</option>
                <option value="offer">Offer</option>
              </select>
            </div>

            <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
              <p className="mb-1 text-sm font-semibold text-navy">Keyword alignment</p>
              <p className="mb-4 text-3xl font-semibold text-ocean">
                {bundle.analysis.overall_keyword_alignment ?? 0}%
              </p>
              <p className="mb-4 text-xs text-navy-light/50">
                Estimated keyword alignment based on your resume — actual ATS systems vary, this
                isn&apos;t a guarantee.
              </p>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                    Skills
                  </p>
                  <SkillComparisonList entries={bundle.analysis.skill_comparison} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                    Keywords
                  </p>
                  <KeywordComparisonList entries={bundle.analysis.keyword_comparison} />
                </div>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            {!selectedCv ? (
              <button
                type="button"
                onClick={handleTailorCv}
                disabled={pending}
                className="flex w-fit items-center gap-2 rounded-full bg-sea-gradient px-6 py-3 text-sm font-semibold text-white shadow-md shadow-ocean/20 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                Tailor My CV
              </button>
            ) : (
              <TailoredCvPreview version={selectedCv} contact={contactInfo} />
            )}

            {selectedCv && !selectedCoverLetter && (
              <button
                type="button"
                onClick={handleCoverLetter}
                disabled={pending}
                className="flex w-fit items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Create Cover Letter
              </button>
            )}

            {selectedCoverLetter && (
              <CoverLetterPreview
                documentId={documentId!}
                letter={selectedCoverLetter}
                companyName={job.company_name}
                jobTitle={job.title}
              />
            )}

            {selectedCv && (
              <a
                href={job.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1.5 text-sm font-medium text-navy-light/70 hover:text-navy print:hidden"
              >
                Apply on source
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </>
        )}
      </div>

      <div className="print:hidden">
        <VersionHistory
          cvVersions={bundle.cvVersionHistory}
          coverLetters={bundle.coverLetterHistory}
          jobTitle={job.title}
          selectedCvVersion={selectedCv?.version_number ?? null}
          selectedCoverLetterVersion={selectedCoverLetter?.version_number ?? null}
          onSelectCv={setSelectedCv}
          onSelectCoverLetter={setSelectedCoverLetter}
        />
      </div>
    </div>
  );
}
