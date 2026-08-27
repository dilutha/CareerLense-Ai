"use client";

import { Printer } from "lucide-react";
import type { ApplicationDocumentVersion } from "@/lib/application/types";
import type { VerifiedFacts } from "@/lib/application/verified-facts";

/**
 * ATS-friendly rendering: standard section headings, single column, plain
 * text bullets, no icons/tables/graphics within the printable area, and
 * consistent date formatting — see docs/AI_AGENT.md's ATS methodology
 * notes for why each of these choices helps machine parsing.
 */
export function TailoredCvPreview({
  version,
  contact,
}: {
  version: ApplicationDocumentVersion;
  contact: Pick<VerifiedFacts, "fullName" | "headline">;
}) {
  const { tailored_content: cv, tailoring_notes: notes } = version;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">Tailored CV — version {version.version_number}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-full border border-navy/10 px-3 py-1.5 text-xs font-medium text-navy hover:bg-foam"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Print / Save as PDF
        </button>
      </div>

      {version.keyword_alignment_before != null && version.keyword_alignment_after != null && (
        <p className="text-sm text-navy-light/70">
          Estimated keyword alignment: {version.keyword_alignment_before}% →{" "}
          <span className="font-semibold text-ocean">{version.keyword_alignment_after}%</span>
        </p>
      )}

      {/* Printable CV — plain typography, standard headings, no icons/graphics. */}
      <div
        data-printable
        className="rounded-2xl border border-navy/10 bg-white p-8 font-sans text-[13px] leading-relaxed text-neutral-900 print:rounded-none print:border-0 print:p-0"
      >
        <h1 className="text-xl font-bold">{contact.fullName ?? "Your Name"}</h1>
        {contact.headline && <p className="text-sm text-neutral-600">{contact.headline}</p>}

        {cv.professionalSummary && (
          <section className="mt-4">
            <h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase tracking-wide">
              Professional Summary
            </h2>
            <p className="mt-2">{cv.professionalSummary}</p>
          </section>
        )}

        {cv.skills.length > 0 && (
          <section className="mt-4">
            <h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase tracking-wide">
              Technical Skills
            </h2>
            <p className="mt-2">{cv.skills.join(", ")}</p>
          </section>
        )}

        {cv.education.length > 0 && (
          <section className="mt-4">
            <h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase tracking-wide">
              Education
            </h2>
            {cv.education.map((edu, i) => (
              <div key={i} className="mt-2">
                <p className="font-semibold">
                  {[edu.degree, edu.field].filter(Boolean).join(", ") || "Studies"}
                </p>
                <p className="text-neutral-600">
                  {edu.institution}
                  {edu.dateRange ? ` · ${edu.dateRange}` : ""}
                </p>
              </div>
            ))}
          </section>
        )}

        {cv.experience.length > 0 && (
          <section className="mt-4">
            <h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase tracking-wide">
              Experience
            </h2>
            {cv.experience.map((exp, i) => (
              <div key={i} className="mt-2">
                <p className="font-semibold">
                  {exp.role} — {exp.company}
                </p>
                {exp.dateRange && <p className="text-neutral-600">{exp.dateRange}</p>}
                {exp.bullets.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {exp.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {cv.projects.length > 0 && (
          <section className="mt-4">
            <h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase tracking-wide">
              Projects
            </h2>
            {cv.projects.map((project, i) => (
              <div key={i} className="mt-2">
                <p className="font-semibold">
                  {project.name}
                  {project.technologies.length > 0 && (
                    <span className="font-normal text-neutral-600"> — {project.technologies.join(", ")}</span>
                  )}
                </p>
                {project.bullets.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {project.bullets.map((b, j) => (
                      <li key={j}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}

        {cv.certifications.length > 0 && (
          <section className="mt-4">
            <h2 className="border-b border-neutral-300 pb-1 text-sm font-bold uppercase tracking-wide">
              Certifications
            </h2>
            <p className="mt-2">{cv.certifications.join(", ")}</p>
          </section>
        )}
      </div>

      {notes.length > 0 && (
        <div className="rounded-2xl border border-navy/10 bg-white p-5 print:hidden">
          <p className="mb-3 text-sm font-semibold text-navy">Here&apos;s what changed</p>
          <div className="flex flex-col gap-4">
            {notes.map((note, i) => (
              <div key={i} className="text-sm">
                <p className="mb-1 font-medium text-navy">{note.section}</p>
                <p className="text-navy-light/60 line-through">{note.before}</p>
                <p className="text-navy">{note.after}</p>
                <p className="mt-1 text-xs text-navy-light/50">{note.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
