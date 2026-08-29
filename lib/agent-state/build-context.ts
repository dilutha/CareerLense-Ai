import type { JobWithMatch } from "@/lib/jobs/types";
import type { CareerAgentState } from "./schema";

/**
 * Compact "what's already known about this search" block (Part 5/6) —
 * appended to the chat system instruction so the conversational reply
 * never re-asks for a target role/location/etc. that's already in state,
 * and only asks about what's genuinely still missing.
 */
export function buildAgentStateContext(state: CareerAgentState): string | null {
  if (state.intent !== "job_search" && !state.targetRole) return null;

  const known: string[] = [];
  if (state.targetRole) known.push(`Target role: ${state.targetRole}`);
  if (state.seniority) known.push(`Level: ${state.seniority}`);
  if (state.locations.length > 0) known.push(`Locations: ${state.locations.join(", ")}`);
  if (state.workModes.length > 0) known.push(`Work mode: ${state.workModes.join(", ")}`);
  if (state.industries.length > 0) known.push(`Industries: ${state.industries.join(", ")}`);
  if (state.companyPreferences.length > 0) known.push(`Company preferences: ${state.companyPreferences.join(", ")}`);
  if (state.companyTypes.length > 0) known.push(`Company type: ${state.companyTypes.join(", ")}`);
  if (state.technologies.length > 0) known.push(`Technologies: ${state.technologies.join(", ")}`);
  if (state.internationalPreference) known.push("Wants international/multinational companies");
  if (state.excludedRoles.length > 0) known.push(`NOT interested in: ${state.excludedRoles.join(", ")}`);
  if (state.excludedCompanies.length > 0) known.push(`Excluding companies: ${state.excludedCompanies.join(", ")}`);
  if (state.excludedWorkModes.length > 0) known.push(`Excluding work modes: ${state.excludedWorkModes.join(", ")}`);
  if (state.salaryExpectation?.min || state.salaryExpectation?.max) {
    const { min, max, currency } = state.salaryExpectation;
    known.push(`Salary expectation: ${min ?? "?"}-${max ?? "?"} ${currency ?? ""}`.trim());
  }

  if (known.length === 0) return null;

  return [
    "CURRENT JOB SEARCH STATE (already known from earlier in this conversation — do NOT ask the user to repeat any of this):",
    ...known.map((line) => `- ${line}`),
  ].join("\n");
}

/**
 * Grounds job-detail questions ("am I qualified?", "salary mentioned?",
 * "how do I apply?" — Part 22) in the ONE currently selected job's real
 * data, so the model never guesses or confuses it with a different job
 * from the results list.
 */
export function buildSelectedJobContext(selected: JobWithMatch): string {
  const { job, match } = selected;
  const lines = [
    "SELECTED JOB (the user is currently asking about this specific one — never confuse it with another result):",
    `Title: ${job.title}${job.company_name ? ` at ${job.company_name}` : ""}`,
    job.location ? `Location: ${job.location}${job.work_mode ? ` (${job.work_mode})` : ""}` : "",
    job.salary_text ? `Salary (as listed): ${job.salary_text}` : "Salary: not listed by the source — never invent a figure.",
    `Application link: ${job.application_url}`,
  ];

  if (match) {
    lines.push(`Match score: ${match.match_score}%`);
    if (match.matched_skills.length > 0) lines.push(`Matched skills: ${match.matched_skills.join(", ")}`);
    if (match.missing_required_skills.length > 0) {
      lines.push(`Missing required skills: ${match.missing_required_skills.join(", ")}`);
    }
    if (match.explanation?.positives?.length) lines.push(`Why it fits: ${match.explanation.positives.join("; ")}`);
    if (match.explanation?.gaps?.length) lines.push(`Gaps: ${match.explanation.gaps.join("; ")}`);
  }

  if (job.requirements) {
    lines.push(`Requirements (from the real listing, truncated): ${job.requirements.slice(0, 600)}`);
  }

  return lines.filter(Boolean).join("\n");
}
