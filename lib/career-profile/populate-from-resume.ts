import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResumeParsedData } from "@/lib/resume/schemas";

export type ProfileEntrySource = "manual" | "cv" | "portfolio" | "github" | "chat";

/**
 * Merges data already extracted by lib/resume/parse-resume.ts (or the
 * portfolio/GitHub equivalents) into the real career-profile tables —
 * closing the gap where resume/portfolio/GitHub analysis stayed siloed
 * from `education`/`experience`/`projects`/`profile_skills` and never
 * informed onboarding or chat's "don't ask what you already know" context.
 *
 * Additive-only: never updates or overwrites an existing row (manual or
 * otherwise) — only inserts an entry that doesn't already exist, matched
 * case-insensitively on the fields that identify it. No second Gemini
 * call; this is pure mechanical merging of data already extracted.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

function norm(value: string): string {
  return value.trim().toLowerCase();
}

async function mergeEducation(
  supabase: AnySupabase,
  userId: string,
  entries: ResumeParsedData["education"],
  source: ProfileEntrySource
): Promise<number> {
  if (entries.length === 0) return 0;

  const { data: existing } = await supabase
    .from("education")
    .select("institution, degree")
    .eq("profile_id", userId);
  const existingKeys = new Set(
    ((existing ?? []) as { institution: string; degree: string | null }[]).map(
      (e) => `${norm(e.institution)}|${norm(e.degree ?? "")}`
    )
  );

  const rows = entries
    .filter((e) => !existingKeys.has(`${norm(e.institution)}|${norm(e.degree ?? "")}`))
    .map((e) => ({
      profile_id: userId,
      institution: e.institution.slice(0, 200),
      degree: e.degree?.slice(0, 150) ?? null,
      field_of_study: e.field?.slice(0, 150) ?? null,
      start_date: null,
      end_date: null,
      is_current: false,
      source,
    }));

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("education").insert(rows);
  return error ? 0 : rows.length;
}

async function mergeExperience(
  supabase: AnySupabase,
  userId: string,
  entries: ResumeParsedData["experience"],
  source: ProfileEntrySource
): Promise<number> {
  if (entries.length === 0) return 0;

  const { data: existing } = await supabase
    .from("experience")
    .select("company, role")
    .eq("profile_id", userId);
  const existingKeys = new Set(
    ((existing ?? []) as { company: string; role: string }[]).map(
      (e) => `${norm(e.company)}|${norm(e.role)}`
    )
  );

  const rows = entries
    .filter((e) => !existingKeys.has(`${norm(e.company)}|${norm(e.role)}`))
    .map((e) => ({
      profile_id: userId,
      company: e.company.slice(0, 200),
      role: e.role.slice(0, 200),
      employment_type: "full_time" as const,
      description: e.description?.slice(0, 1000) ?? null,
      start_date: null,
      end_date: null,
      is_current: false,
      source,
    }));

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("experience").insert(rows);
  return error ? 0 : rows.length;
}

async function mergeProjects(
  supabase: AnySupabase,
  userId: string,
  entries: ResumeParsedData["projects"],
  source: ProfileEntrySource
): Promise<number> {
  if (entries.length === 0) return 0;

  const { data: existing } = await supabase.from("projects").select("name").eq("profile_id", userId);
  const existingKeys = new Set(((existing ?? []) as { name: string }[]).map((p) => norm(p.name)));

  const rows = entries
    .filter((p) => !existingKeys.has(norm(p.name)))
    .map((p) => ({
      profile_id: userId,
      name: p.name.slice(0, 200),
      description: p.description?.slice(0, 1000) ?? null,
      is_current: false,
      source,
    }));

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("projects").insert(rows);
  return error ? 0 : rows.length;
}

async function mergeSkills(
  supabase: AnySupabase,
  userId: string,
  entries: ResumeParsedData["skills"],
  source: ProfileEntrySource
): Promise<number> {
  if (entries.length === 0) return 0;

  const { data: existingLinks } = await supabase
    .from("profile_skills")
    .select("skill_id")
    .eq("profile_id", userId);
  const linkedSkillIds = new Set(((existingLinks ?? []) as { skill_id: string }[]).map((l) => l.skill_id));

  let added = 0;
  for (const skill of entries) {
    const name = skill.name.trim();
    if (!name) continue;

    const { data: existingSkill } = await supabase
      .from("skills")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    let skillId: string | undefined = existingSkill?.id;
    if (!skillId) {
      const { data: created } = await supabase
        .from("skills")
        .insert({ name: name.slice(0, 80), category: skill.category?.slice(0, 40) || "other" })
        .select("id")
        .single();
      skillId = created?.id;
    }
    if (!skillId || linkedSkillIds.has(skillId)) continue;

    const { error } = await supabase
      .from("profile_skills")
      .insert({ profile_id: userId, skill_id: skillId, proficiency: "intermediate", source });
    if (!error) {
      added += 1;
      linkedSkillIds.add(skillId);
    }
  }
  return added;
}

export interface PopulateResult {
  educationAdded: number;
  experienceAdded: number;
  projectsAdded: number;
  skillsAdded: number;
}

/**
 * Merges a CV's structured data (already extracted by
 * parseAndEvaluateResume) into the profile tables — called once right
 * after processResumeCore builds the resume_analysis row, reusing that
 * same extraction rather than a second Gemini call.
 */
export async function populateProfileFromResume(
  supabase: AnySupabase,
  userId: string,
  parsed: ResumeParsedData
): Promise<PopulateResult> {
  const [educationAdded, experienceAdded, projectsAdded, skillsAdded] = await Promise.all([
    mergeEducation(supabase, userId, parsed.education, "cv"),
    mergeExperience(supabase, userId, parsed.experience, "cv"),
    mergeProjects(supabase, userId, parsed.projects, "cv"),
    mergeSkills(supabase, userId, parsed.skills, "cv"),
  ]);

  return { educationAdded, experienceAdded, projectsAdded, skillsAdded };
}

/** Portfolio/GitHub analyses only surface skill names + project names/descriptions — no education/experience. */
export async function populateProfileFromSkillsAndProjects(
  supabase: AnySupabase,
  userId: string,
  input: { skills: { name: string; category?: string }[]; projects: { name: string; description?: string | null }[] },
  source: "portfolio" | "github"
): Promise<{ skillsAdded: number; projectsAdded: number }> {
  const [skillsAdded, projectsAdded] = await Promise.all([
    mergeSkills(supabase, userId, input.skills.map((s) => ({ name: s.name, category: s.category ?? "other" })), source),
    mergeProjects(
      supabase,
      userId,
      input.projects.map((p) => ({ name: p.name, description: p.description ?? null, technologies: [] })),
      source
    ),
  ]);
  return { skillsAdded, projectsAdded };
}
