import type { CareerProfile } from "./types";

export interface ProfileCompletion {
  percent: number;
  missing: string[];
}

/**
 * Simple, explainable completion score. Fields are weighted by how useful
 * they are to CareerLens (target role and having *some* skills/education
 * matter more than an optional link), not weighted equally.
 */
export function calculateProfileCompletion(profile: CareerProfile): ProfileCompletion {
  const missing: string[] = [];
  let percent = 0;

  if (profile.profile.full_name?.trim()) {
    percent += 15;
  } else {
    missing.push("Add your name");
  }

  if (profile.education.length > 0) {
    percent += 15;
  } else {
    missing.push("Add your education");
  }

  if (profile.skills.length >= 3) {
    percent += 15;
  } else {
    missing.push("Add a few skills");
  }

  if (profile.projects.length > 0) {
    percent += 15;
  } else {
    missing.push("Add a project");
  }

  if (profile.careerPreferences?.target_role?.trim()) {
    percent += 20;
  } else {
    missing.push("Set your target role");
  }

  const hasLocation =
    Boolean(profile.profile.location?.trim()) ||
    (profile.careerPreferences?.preferred_locations.length ?? 0) > 0;
  if (hasLocation) {
    percent += 10;
  } else {
    missing.push("Add a preferred location");
  }

  const hasLink =
    Boolean(profile.profile.portfolio_url?.trim()) ||
    Boolean(profile.profile.github_url?.trim()) ||
    Boolean(profile.profile.linkedin_url?.trim());
  if (hasLink) {
    percent += 10;
  } else {
    missing.push("Add a portfolio, GitHub, or LinkedIn link");
  }

  return { percent, missing };
}
