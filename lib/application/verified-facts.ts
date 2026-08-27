import "server-only";
import type { CareerProfile } from "@/lib/career-profile/types";
import type { ResumeVersion } from "@/lib/resume/types";

/**
 * The complete, closed set of facts Gemini is allowed to reference when
 * tailoring a CV or writing a cover letter — built entirely from the
 * user's own profile + selected resume, never invented. The tailoring
 * prompt explicitly forbids introducing any skill, employer, project, or
 * credential not present here (see prompts.ts).
 */
export interface VerifiedFacts {
  fullName: string | null;
  headline: string | null;
  bio: string | null;
  skills: string[];
  education: { institution: string; degree: string | null; field: string | null; dateRange: string | null }[];
  experience: {
    company: string;
    role: string;
    dateRange: string | null;
    description: string | null;
  }[];
  projects: { name: string; description: string | null; technologies: string[] }[];
  certifications: string[];
  languages: string[];
}

function formatDateRange(start: string | null, end: string | null, isCurrent: boolean): string | null {
  if (!start && !end && !isCurrent) return null;
  const startLabel = start ?? "?";
  const endLabel = isCurrent ? "Present" : (end ?? "?");
  return `${startLabel} – ${endLabel}`;
}

export function buildVerifiedFacts(
  profile: CareerProfile | null,
  resumeVersion: ResumeVersion | null
): VerifiedFacts {
  const profileSkills = profile?.skills.map((s) => s.skill.name) ?? [];
  const resumeSkills = resumeVersion?.parsed_data?.skills.map((s) => s.name) ?? [];
  const skills = [...new Set([...profileSkills, ...resumeSkills])];

  const profileEducation =
    profile?.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field_of_study,
      dateRange: formatDateRange(e.start_date, e.end_date, e.is_current),
    })) ?? [];
  const resumeEducation =
    resumeVersion?.parsed_data?.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      dateRange: e.start_date || e.end_date ? `${e.start_date ?? "?"} – ${e.end_date ?? "?"}` : null,
    })) ?? [];

  const profileExperience =
    profile?.experience.map((e) => ({
      company: e.company,
      role: e.role,
      dateRange: formatDateRange(e.start_date, e.end_date, e.is_current),
      description: e.description,
    })) ?? [];
  const resumeExperience =
    resumeVersion?.parsed_data?.experience.map((e) => ({
      company: e.company,
      role: e.role,
      dateRange: e.start_date || e.end_date ? `${e.start_date ?? "?"} – ${e.end_date ?? "?"}` : null,
      description: e.description,
    })) ?? [];

  const profileProjects =
    profile?.projects.map((p) => ({
      name: p.name,
      description: p.description,
      technologies: [] as string[],
    })) ?? [];
  const resumeProjects =
    resumeVersion?.parsed_data?.projects.map((p) => ({
      name: p.name,
      description: p.description,
      technologies: p.technologies,
    })) ?? [];

  // Merge by name (case-insensitive) so a project mentioned in both isn't duplicated.
  const projectsByName = new Map<string, VerifiedFacts["projects"][number]>();
  for (const project of [...profileProjects, ...resumeProjects]) {
    const key = project.name.trim().toLowerCase();
    const existing = projectsByName.get(key);
    projectsByName.set(key, {
      name: project.name,
      description: project.description ?? existing?.description ?? null,
      technologies: [...new Set([...(existing?.technologies ?? []), ...project.technologies])],
    });
  }

  return {
    fullName: profile?.profile.full_name ?? null,
    headline: profile?.profile.headline ?? null,
    bio: profile?.profile.bio ?? null,
    skills,
    education: [...profileEducation, ...resumeEducation],
    experience: [...profileExperience, ...resumeExperience],
    projects: [...projectsByName.values()],
    certifications: resumeVersion?.parsed_data?.certifications ?? [],
    languages: resumeVersion?.parsed_data?.languages ?? [],
  };
}

/** Flat evidence text for the deterministic comparator (lib/application/compare.ts). */
export function verifiedFactsToEvidenceText(facts: VerifiedFacts): string {
  return [
    facts.bio,
    ...facts.experience.map((e) => `${e.role} ${e.company} ${e.description ?? ""}`),
    ...facts.projects.map((p) => `${p.name} ${p.description ?? ""} ${p.technologies.join(" ")}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
