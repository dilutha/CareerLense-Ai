import "server-only";
import type { CareerProfile } from "./types";

const MAX_FIELD_LENGTH = 280;

function truncate(text: string): string {
  return text.length > MAX_FIELD_LENGTH ? `${text.slice(0, MAX_FIELD_LENGTH)}…` : text;
}

/**
 * Transforms a full career profile into a compact, human-readable text
 * block for the Gemini system context — never the raw database rows.
 * Only fields the user actually filled in are included, so the model
 * can't mistake an empty field for "user has none of this."
 */
export function buildCareerContext(profile: CareerProfile): string {
  const lines: string[] = ["CAREER PROFILE:"];

  if (profile.profile.full_name) lines.push(`Name: ${profile.profile.full_name}`);
  if (profile.profile.headline) lines.push(`Headline: ${truncate(profile.profile.headline)}`);
  if (profile.profile.location) lines.push(`Location: ${profile.profile.location}`);
  if (profile.profile.bio) lines.push(`Bio: ${truncate(profile.profile.bio)}`);

  if (profile.education.length > 0) {
    lines.push("", "Education:");
    for (const edu of profile.education) {
      const qualifier = [edu.degree, edu.field_of_study].filter(Boolean).join(", ") || "Studies";
      const status = edu.is_current ? "current" : edu.end_date;
      lines.push(`- ${qualifier} at ${edu.institution}${status ? ` (${status})` : ""}`);
    }
  }

  if (profile.skills.length > 0) {
    lines.push(
      "",
      `Skills: ${profile.skills.map((s) => `${s.skill.name} (${s.proficiency})`).join(", ")}`
    );
  }

  if (profile.experience.length > 0) {
    lines.push("", "Experience:");
    for (const exp of profile.experience) {
      lines.push(
        `- ${exp.role} at ${exp.company} (${exp.employment_type}${exp.is_current ? ", current" : ""})`
      );
    }
  }

  if (profile.projects.length > 0) {
    lines.push("", "Projects:");
    for (const project of profile.projects) {
      lines.push(
        `- ${project.name}${project.description ? `: ${truncate(project.description)}` : ""}`
      );
    }
  }

  const prefs = profile.careerPreferences;
  if (prefs && (prefs.target_role || prefs.preferred_locations.length > 0 || prefs.remote_preference)) {
    lines.push("", "Career preferences:");
    if (prefs.target_role) lines.push(`Target role: ${prefs.target_role}`);
    if (prefs.employment_type) lines.push(`Employment type: ${prefs.employment_type}`);
    if (prefs.preferred_locations.length > 0) {
      lines.push(`Preferred locations: ${prefs.preferred_locations.join(", ")}`);
    }
    if (prefs.remote_preference) lines.push(`Remote preference: ${prefs.remote_preference}`);
  }

  const links = [
    profile.profile.portfolio_url && `Portfolio: ${profile.profile.portfolio_url}`,
    profile.profile.github_url && `GitHub: ${profile.profile.github_url}`,
    profile.profile.linkedin_url && `LinkedIn: ${profile.profile.linkedin_url}`,
  ].filter((line): line is string => Boolean(line));
  if (links.length > 0) lines.push("", ...links);

  // Nothing filled in at all — say so explicitly rather than sending a
  // near-empty header, so the model reliably asks instead of guessing.
  if (lines.length === 1) {
    return "CAREER PROFILE: The user has not filled in any profile information yet. Ask what you need naturally, one or two questions at a time.";
  }

  return lines.join("\n");
}
