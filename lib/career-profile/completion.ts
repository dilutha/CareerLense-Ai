import type { CareerProfile } from "./types";

export interface ProfileCompletionItem {
  label: string;
  done: boolean;
}

export interface ProfileCompletion {
  percent: number;
  /** Every checked field, done or not — powers a ✓/○ checklist (Part 23: never a bare "45% complete" number with no context). */
  items: ProfileCompletionItem[];
}

/**
 * Simple, explainable completion score. Fields are weighted by how useful
 * they are to CareerLens (target role and having *some* skills/education
 * matter more than an optional link), not weighted equally.
 */
export function calculateProfileCompletion(profile: CareerProfile): ProfileCompletion {
  const items: ProfileCompletionItem[] = [];
  let percent = 0;

  function check(label: string, weight: number, done: boolean) {
    items.push({ label, done });
    if (done) percent += weight;
  }

  check("Your name", 15, Boolean(profile.profile.full_name?.trim()));
  check("Education", 15, profile.education.length > 0);
  check("Skills", 15, profile.skills.length >= 3);
  check("Projects", 15, profile.projects.length > 0);
  check("Target role", 20, Boolean(profile.careerPreferences?.target_role?.trim()));

  const hasLocation =
    Boolean(profile.profile.location?.trim()) ||
    (profile.careerPreferences?.preferred_locations.length ?? 0) > 0;
  check("Preferred location", 10, hasLocation);

  const hasLink =
    Boolean(profile.profile.portfolio_url?.trim()) ||
    Boolean(profile.profile.github_url?.trim()) ||
    Boolean(profile.profile.linkedin_url?.trim());
  check("Portfolio, GitHub, or LinkedIn link", 10, hasLink);

  return { percent, items };
}
