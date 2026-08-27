"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Plus, Waves, X } from "lucide-react";
import {
  addEducation,
  addProfileSkill,
  addProject,
  updateBasicProfile,
  updateCareerPreferences,
} from "@/lib/career-profile/actions";
import type { SkillProficiency } from "@/lib/supabase/types";

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

export function ProfileSetupWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Try again.");
        return;
      }
      next();
    });
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
          className="flex w-fit items-center gap-1 text-xs font-medium text-navy-light/50 hover:text-navy"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Back
        </button>
      )}
    </div>
  );
}
