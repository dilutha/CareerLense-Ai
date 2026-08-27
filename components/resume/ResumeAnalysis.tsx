import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ResumeWithAnalysis } from "@/lib/resume/types";
import { ResumeScore } from "./ResumeScore";
import { ResumeSection } from "./ResumeSection";

export function ResumeAnalysis({ resumeWithAnalysis }: { resumeWithAnalysis: ResumeWithAnalysis }) {
  const { resume, version, analysis } = resumeWithAnalysis;

  if (resume.status === "failed") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">Something went wrong while reading this CV.</p>
        {resume.error_message && <p className="mt-1 text-sm">{resume.error_message}</p>}
      </div>
    );
  }

  if (resume.status !== "ready" || !analysis) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-navy-light/70">
        I&apos;m still reading through it...
      </div>
    );
  }

  const parsed = version?.parsed_data ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
        <p className="mb-4 text-lg font-semibold text-navy">CareerLens Resume Review 🌊</p>
        <ResumeScore overall={analysis.overall_score ?? 0} breakdown={analysis.score_breakdown} />
        {analysis.summary && (
          <p className="mt-4 border-t border-navy/10 pt-4 text-sm text-navy-light/80">
            {analysis.summary}
          </p>
        )}
      </div>

      <ResumeSection title="What's good" defaultOpen>
        {analysis.strengths.length === 0 ? (
          <p className="text-sm text-navy-light/60">No standout strengths detected yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {analysis.strengths.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  <span className="font-medium text-navy">{f.label}</span>
                  <span className="text-navy-light/70"> — {f.explanation}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </ResumeSection>

      <ResumeSection title="What needs work" defaultOpen>
        {analysis.weaknesses.length === 0 ? (
          <p className="text-sm text-navy-light/60">Nothing major stood out — nice.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {analysis.weaknesses.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <span>
                  <span className="font-medium text-navy">{f.label}</span>
                  <span className="text-navy-light/70"> — {f.explanation}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </ResumeSection>

      <ResumeSection title="Skills detected">
        {analysis.skills.length === 0 ? (
          <p className="text-sm text-navy-light/60">No skills detected in this CV.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {analysis.skills.map((skill, i) => (
              <span
                key={i}
                className="rounded-full bg-foam px-3 py-1 text-xs font-medium text-navy"
              >
                {skill.name}
              </span>
            ))}
          </div>
        )}
      </ResumeSection>

      <ResumeSection title="Experience">
        {analysis.experience_summary ? (
          <p className="text-sm text-navy-light/80">{analysis.experience_summary}</p>
        ) : (
          <p className="text-sm text-navy-light/60">
            No experience found — that&apos;s completely okay, especially if projects and
            internships tell the story instead.
          </p>
        )}
      </ResumeSection>

      <ResumeSection title="Education">
        {analysis.education_summary ? (
          <p className="text-sm text-navy-light/80">{analysis.education_summary}</p>
        ) : (
          <p className="text-sm text-navy-light/60">No education section found.</p>
        )}
      </ResumeSection>

      <ResumeSection title="Projects">
        {analysis.projects.length === 0 ? (
          <p className="text-sm text-navy-light/60">No projects found in this CV.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {analysis.projects.map((project, i) => (
              <li key={i}>
                <p className="text-sm font-medium text-navy">{project.name}</p>
                {project.description && (
                  <p className="text-sm text-navy-light/70">{project.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ResumeSection>

      {analysis.missing_sections.length > 0 && (
        <ResumeSection title="Missing information">
          <ul className="flex flex-col gap-1.5">
            {analysis.missing_sections.map((section, i) => (
              <li key={i} className="text-sm text-navy-light/70">
                ○ {section}
              </li>
            ))}
          </ul>
        </ResumeSection>
      )}

      {(analysis.keyword_suggestions.length > 0 || analysis.formatting_feedback.length > 0) && (
        <ResumeSection title="Suggestions">
          <div className="flex flex-col gap-4">
            {analysis.keyword_suggestions.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                  Keywords to consider
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.keyword_suggestions.map((kw, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-ocean/20 bg-foam px-3 py-1 text-xs font-medium text-ocean"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {analysis.formatting_feedback.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-light/50">
                  Formatting
                </p>
                <ul className="flex flex-col gap-1.5">
                  {analysis.formatting_feedback.map((note, i) => (
                    <li key={i} className="text-sm text-navy-light/70">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ResumeSection>
      )}

      {parsed && (parsed.certifications.length > 0 || parsed.languages.length > 0) && (
        <ResumeSection title="Certifications & languages">
          {parsed.certifications.length > 0 && (
            <p className="mb-2 text-sm text-navy-light/80">
              <span className="font-medium text-navy">Certifications: </span>
              {parsed.certifications.join(", ")}
            </p>
          )}
          {parsed.languages.length > 0 && (
            <p className="text-sm text-navy-light/80">
              <span className="font-medium text-navy">Languages: </span>
              {parsed.languages.join(", ")}
            </p>
          )}
        </ResumeSection>
      )}
    </div>
  );
}
