"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FileText, GitFork, Globe, Loader2, MessageCircle, Plus, Waves, X } from "lucide-react";
import {
  addEducation,
  addProfileSkill,
  addProject,
  updateBasicProfile,
  updateCareerPreferences,
} from "@/lib/career-profile/actions";
import { analyzeGitHub } from "@/lib/github/actions";
import { analyzePortfolio } from "@/lib/portfolio/actions";
import { getResumeReviewSummary, processResume, uploadResume, type ResumeReviewSummary } from "@/lib/resume/actions";
import type { SkillProficiency } from "@/lib/supabase/types";
import { createRequestGuard } from "@/lib/utils/request-guard";

const TOTAL_STEPS = 7;
const LOCATION_SUGGESTIONS = ["Colombo", "Kandy", "Galle", "Remote", "Anywhere in Sri Lanka"];
const ROLE_SUGGESTIONS = [
  "Data Analyst",
  "Software Engineer",
  "Cybersecurity Analyst",
  "Business Analyst",
  "UI/UX Designer",
];

const inputClass =
  "w-full rounded-xl border border-navy/10 bg-foam px-4 py-2.5 text-sm text-navy placeholder:text-navy-light/50 focus:border-ocean/40 focus:outline-none sm:text-base";

type UrlSourceKind = "portfolio" | "github";

/**
 * Part 1's redesigned entry point — CV/portfolio/GitHub/chat/skip, instead
 * of forcing the 7-step manual wizard below. Only CV upload leads into a
 * review step here (the only source with a clean structured extraction
 * already wired to the profile tables — see lib/career-profile/
 * populate-from-resume.ts); portfolio/GitHub just run their existing
 * analysis and confirm, then continue.
 */
function WelcomeSourceStep({
  onCvUploaded,
  onSkipToChat,
}: {
  onCvUploaded: (resumeId: string) => void;
  onSkipToChat: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState<UrlSourceKind | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlPending, setUrlPending] = useState(false);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    const uploaded = await uploadResume(formData);
    if (!uploaded.success || !uploaded.resumeId) {
      setUploading(false);
      setError(uploaded.error ?? "Couldn't upload that file.");
      return;
    }

    const processed = await processResume(uploaded.resumeId);
    setUploading(false);
    if (!processed.success) {
      setError(processed.error ?? "Couldn't read that CV.");
      return;
    }
    onCvUploaded(uploaded.resumeId);
  }

  async function submitUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setUrlPending(true);
    setError(null);
    setUrlMessage(null);

    const result =
      urlMode === "github" ? await analyzeGitHub(url) : await analyzePortfolio(url);

    setUrlPending(false);
    if (!result.success) {
      setError(
        result.error ??
          `I couldn't read that ${urlMode} automatically. You can continue with your CV or tell me about your experience in chat.`
      );
      return;
    }
    setUrlMessage(
      urlMode === "github"
        ? "Got it — I've pulled in the languages and projects from your public repos."
        : "Got it — I've taken a look at your portfolio."
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-lg flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-navy sm:text-2xl">Let&apos;s build your career profile</h2>
        <p className="text-sm text-navy-light/70">
          You don&apos;t need to fill everything manually. Upload your CV, share your portfolio or
          GitHub, and I&apos;ll extract what I need.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          {error}
        </div>
      )}
      {urlMessage && (
        <div className="rounded-xl border border-ocean/20 bg-foam px-3.5 py-2.5 text-sm text-navy">
          {urlMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          ref={fileInputRef}
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
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2.5 rounded-xl border border-navy/10 bg-white px-4 py-3.5 text-left text-sm font-medium text-navy shadow-sm transition-colors hover:border-ocean/30 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-ocean" aria-hidden="true" />
          ) : (
            <FileText className="h-5 w-5 shrink-0 text-ocean" aria-hidden="true" />
          )}
          {uploading ? "Reading your CV..." : "Upload CV / Resume"}
        </button>

        <button
          type="button"
          onClick={() => {
            setUrlMode("portfolio");
            setUrlMessage(null);
            setError(null);
          }}
          className="flex items-center gap-2.5 rounded-xl border border-navy/10 bg-white px-4 py-3.5 text-left text-sm font-medium text-navy shadow-sm transition-colors hover:border-ocean/30"
        >
          <Globe className="h-5 w-5 shrink-0 text-ocean" aria-hidden="true" />
          Portfolio URL
        </button>

        <button
          type="button"
          onClick={() => {
            setUrlMode("github");
            setUrlMessage(null);
            setError(null);
          }}
          className="flex items-center gap-2.5 rounded-xl border border-navy/10 bg-white px-4 py-3.5 text-left text-sm font-medium text-navy shadow-sm transition-colors hover:border-ocean/30"
        >
          <GitFork className="h-5 w-5 shrink-0 text-ocean" aria-hidden="true" />
          GitHub URL
        </button>

        <button
          type="button"
          onClick={onSkipToChat}
          className="flex items-center gap-2.5 rounded-xl border border-navy/10 bg-white px-4 py-3.5 text-left text-sm font-medium text-navy shadow-sm transition-colors hover:border-ocean/30"
        >
          <MessageCircle className="h-5 w-5 shrink-0 text-ocean" aria-hidden="true" />
          Continue with Chat
        </button>
      </div>

      {urlMode && (
        <div className="flex flex-col gap-2 rounded-xl border border-navy/10 bg-foam p-3.5">
          <div className="flex gap-2">
            <input
              autoFocus
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitUrl();
              }}
              placeholder={urlMode === "github" ? "github.com/yourusername" : "https://your-portfolio.com"}
              className={inputClass}
            />
            <button
              type="button"
              disabled={!urlInput.trim() || urlPending}
              onClick={submitUrl}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-sea-gradient px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {urlPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Go
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={onSkipToChat}
          className="text-sm font-medium text-navy-light/60 hover:text-navy"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="text-sm font-medium text-navy-light/60 hover:text-navy"
        >
          I&apos;d rather fill it in manually →
        </button>
      </div>
    </motion.div>
  );
}

/** Part 2's compact "here's what I found" review — never forces every field, just confirms/edits. */
function CvReviewStep({
  summary,
  onLooksGood,
  onAddManually,
}: {
  summary: ResumeReviewSummary;
  onLooksGood: () => void;
  onAddManually: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex w-full max-w-lg flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium uppercase tracking-wide text-ocean">From your CV</span>
        <h2 className="text-xl font-semibold text-navy sm:text-2xl">Here&apos;s what I found</h2>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-foam p-4 text-sm text-navy">
        {summary.educationSummary && (
          <p>
            <span aria-hidden="true">🎓</span> {summary.educationSummary}
          </p>
        )}
        {summary.experienceSummary && (
          <p>
            <span aria-hidden="true">💼</span> {summary.experienceSummary}
          </p>
        )}
        {summary.skills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span aria-hidden="true">🛠</span>
            {summary.skills.slice(0, 12).map((skill) => (
              <span key={skill} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-navy-light/80">
                {skill}
              </span>
            ))}
          </div>
        )}
        {summary.projectCount > 0 && (
          <p>
            <span aria-hidden="true">📊</span> {summary.projectCount} project
            {summary.projectCount === 1 ? "" : "s"} found
          </p>
        )}
        {summary.suggestedTargetRole && (
          <p>
            <span aria-hidden="true">🎯</span> Possible target role: {summary.suggestedTargetRole}
          </p>
        )}
      </div>

      <p className="text-sm text-navy-light/70">Is this correct?</p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onLooksGood}
          className="flex items-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 transition-transform hover:scale-[1.02]"
        >
          Looks good
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onAddManually}
          className="text-sm font-medium text-navy-light/60 hover:text-navy"
        >
          Add something
        </button>
      </div>
    </motion.div>
  );
}

function StepShell({
  eyebrow,
  title,
  children,
  onContinue,
  onSkip,
  continueLabel = "Continue →",
  continueDisabled = false,
  pending = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  onContinue: () => void;
  onSkip?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  pending?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.25 }}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium uppercase tracking-wide text-ocean">{eyebrow}</span>
        <h2 className="text-xl font-semibold text-navy sm:text-2xl">{title}</h2>
      </div>

      {children}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled || pending}
          className="flex items-center gap-2 rounded-full bg-sea-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean/20 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {continueLabel}
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-navy-light/60 hover:text-navy"
          >
            Skip for now
          </button>
        )}
      </div>
    </motion.div>
  );
}

type Phase = "welcome" | "cvReview" | "wizard";

export function ProfileSetupWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [cvSummary, setCvSummary] = useState<ResumeReviewSummary | null>(null);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Guards a slower, superseded save from applying its result (and
  // advancing the step) after a newer one already has — see
  // lib/utils/request-guard.ts. Root cause of a real bug: the "Back"
  // button below wasn't disabled during `pending`, so a user could save
  // step 2, immediately go back and change their answer, and re-save
  // before the first save's response arrived — two in-flight requests
  // racing over which one's `next()` call actually lands.
  const requestGuard = useRef(createRequestGuard());

  const [name, setName] = useState(initialName);
  const [institution, setInstitution] = useState("");
  const [degree, setDegree] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [isCurrentStudy, setIsCurrentStudy] = useState(true);
  const [targetRole, setTargetRole] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skillProficiency, setSkillProficiency] = useState<SkillProficiency>("intermediate");
  const [addedSkills, setAddedSkills] = useState<string[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function toggleLocation(location: string) {
    setLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  }

  function addCustomLocation() {
    const trimmed = locationInput.trim();
    if (trimmed && !locations.includes(trimmed)) {
      setLocations((prev) => [...prev, trimmed]);
    }
    setLocationInput("");
  }

  function runStep(action: () => Promise<{ success: boolean; error?: string }>) {
    const token = requestGuard.current.start();
    startTransition(async () => {
      const result = await action();
      // A newer step-save has started since this one was fired (e.g. the
      // user went Back and re-submitted before this response arrived) —
      // applying a stale result here could advance the wizard an extra
      // step or show a stale error over a save that actually succeeded.
      if (!requestGuard.current.isCurrent(token)) return;
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Try again.");
        return;
      }
      next();
    });
  }

  async function handleCvUploaded(resumeId: string) {
    const result = await getResumeReviewSummary(resumeId);
    if (!result.success || !result.summary) {
      // Analysis itself succeeded (processResume already returned success
      // before this was called) but the review fetch didn't — don't block
      // onboarding on a summary that failed to load, per Part 3.
      router.push("/chat");
      return;
    }
    setCvSummary(result.summary);
    if (result.summary.suggestedTargetRole) setTargetRole(result.summary.suggestedTargetRole);
    setPhase("cvReview");
  }

  if (phase === "welcome") {
    return (
      <WelcomeSourceStep onCvUploaded={handleCvUploaded} onSkipToChat={() => router.push("/chat")} />
    );
  }

  if (phase === "cvReview" && cvSummary) {
    return (
      <CvReviewStep
        summary={cvSummary}
        onLooksGood={() => router.push("/chat")}
        onAddManually={() => setPhase("wizard")}
      />
    );
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-navy-light/60">
          <span>
            Step {Math.min(step + 1, TOTAL_STEPS)} of {TOTAL_STEPS}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
          <motion.div
            className="h-full rounded-full bg-sea-gradient"
            animate={{ width: `${(Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
        >
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 0 && (
          <StepShell
            key="name"
            eyebrow="First things first"
            title="What should I call you?"
            continueDisabled={!name.trim()}
            pending={pending}
            onContinue={() =>
              runStep(() => updateBasicProfile({ full_name: name.trim() }))
            }
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            key="education"
            eyebrow="Your background"
            title="What are you studying (or did you study)?"
            continueDisabled={!institution.trim()}
            pending={pending}
            onSkip={next}
            onContinue={() =>
              runStep(() =>
                addEducation({
                  institution: institution.trim(),
                  degree: degree.trim() || undefined,
                  field_of_study: fieldOfStudy.trim() || undefined,
                  is_current: isCurrentStudy,
                })
              )
            }
          >
            <div className="flex flex-col gap-3">
              <input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="University / institution"
                className={inputClass}
              />
              <input
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="Degree (e.g. BSc Data Science)"
                className={inputClass}
              />
              <input
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                placeholder="Field of study (optional)"
                className={inputClass}
              />
              <label className="flex items-center gap-2 text-sm text-navy-light/80">
                <input
                  type="checkbox"
                  checked={isCurrentStudy}
                  onChange={(e) => setIsCurrentStudy(e.target.checked)}
                  className="h-4 w-4 rounded border-navy/20 text-ocean focus:ring-ocean"
                />
                I&apos;m currently studying here
              </label>
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            key="role"
            eyebrow="Direction"
            title="What kind of role are you looking for?"
            continueDisabled={!targetRole.trim()}
            pending={pending}
            onContinue={() =>
              runStep(() =>
                updateCareerPreferences({
                  target_role: targetRole.trim(),
                  preferred_locations: locations,
                  preferred_industries: [],
                })
              )
            }
          >
            <div className="flex flex-col gap-3">
              <input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Data Analyst"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-2">
                {ROLE_SUGGESTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setTargetRole(role)}
                    className="rounded-full border border-navy/10 bg-foam px-3 py-1.5 text-xs font-medium text-navy-light/80 hover:border-ocean/30 hover:text-navy"
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            key="location"
            eyebrow="Where"
            title="Where are you looking?"
            pending={pending}
            onSkip={next}
            onContinue={() =>
              runStep(() =>
                updateCareerPreferences({
                  target_role: targetRole.trim() || undefined,
                  preferred_locations: locations,
                  preferred_industries: [],
                })
              )
            }
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {LOCATION_SUGGESTIONS.map((location) => (
                  <button
                    key={location}
                    type="button"
                    onClick={() => toggleLocation(location)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      locations.includes(location)
                        ? "border-ocean bg-sea-gradient text-white"
                        : "border-navy/10 bg-foam text-navy-light/80 hover:border-ocean/30"
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomLocation();
                    }
                  }}
                  placeholder="Custom location"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addCustomLocation}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foam text-navy hover:bg-navy/10"
                  aria-label="Add location"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            key="skills"
            eyebrow="What you bring"
            title="What skills do you have?"
            pending={pending}
            onSkip={next}
            onContinue={next}
          >
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  placeholder="e.g. Python"
                  className={inputClass}
                />
                <select
                  value={skillProficiency}
                  onChange={(e) => setSkillProficiency(e.target.value as SkillProficiency)}
                  className="rounded-xl border border-navy/10 bg-foam px-2 text-sm text-navy focus:border-ocean/40 focus:outline-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
                <button
                  type="button"
                  disabled={!skillInput.trim() || pending}
                  onClick={() => {
                    const name = skillInput.trim();
                    if (!name) return;
                    startTransition(async () => {
                      const result = await addProfileSkill({
                        skillName: name,
                        proficiency: skillProficiency,
                      });
                      if (!result.success) {
                        setError(result.error ?? "Couldn't add that skill.");
                        return;
                      }
                      setAddedSkills((prev) => [...prev, name]);
                      setSkillInput("");
                    });
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foam text-navy hover:bg-navy/10 disabled:opacity-40"
                  aria-label="Add skill"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {addedSkills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {addedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-sea-gradient px-3 py-1 text-xs font-medium text-white"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            key="projects"
            eyebrow="Show your work"
            title="Got any projects? Projects count. 🚀"
            pending={pending}
            onSkip={next}
            continueDisabled={!projectName.trim()}
            onContinue={() =>
              runStep(() =>
                addProject({
                  name: projectName.trim(),
                  description: projectDescription.trim() || undefined,
                  project_url: projectUrl.trim() || undefined,
                  is_current: false,
                })
              )
            }
          >
            <div className="flex flex-col gap-3">
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
                className={inputClass}
              />
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="What does it do? (optional)"
                rows={3}
                className={`${inputClass} resize-none`}
              />
              <input
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="Link (optional)"
                className={inputClass}
              />
            </div>
          </StepShell>
        )}

        {step === 6 && (
          <StepShell
            key="links"
            eyebrow="Almost done"
            title="Portfolio, LinkedIn, GitHub?"
            pending={pending}
            onSkip={() => runStep(() => Promise.resolve({ success: true }))}
            onContinue={() =>
              runStep(() =>
                updateBasicProfile({
                  full_name: name.trim(),
                  portfolio_url: portfolioUrl.trim() || undefined,
                  linkedin_url: linkedinUrl.trim() || undefined,
                  github_url: githubUrl.trim() || undefined,
                })
              )
            }
          >
            <div className="flex flex-col gap-3">
              <input
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="Portfolio URL (optional)"
                className={inputClass}
              />
              <input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="LinkedIn URL (optional)"
                className={inputClass}
              />
              <input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="GitHub URL (optional)"
                className={inputClass}
              />
            </div>
          </StepShell>
        )}

        {step === TOTAL_STEPS && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-4 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sea-gradient text-white shadow-lg shadow-ocean/20">
              <Waves className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="text-lg font-semibold text-navy">
              Nice. Your CareerLens profile is ready. 🌊
            </p>
            <button
              type="button"
              onClick={() => router.push("/chat")}
              className="flex items-center gap-2 rounded-full bg-sea-gradient px-6 py-3 text-sm font-semibold text-white shadow-md shadow-ocean/20 transition-transform hover:scale-[1.02]"
            >
              Let&apos;s Start
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {step > 0 && step < TOTAL_STEPS && (
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={pending}
          className="flex w-fit items-center gap-1 text-xs font-medium text-navy-light/50 hover:text-navy disabled:opacity-40"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Back
        </button>
      )}
    </div>
  );
}
