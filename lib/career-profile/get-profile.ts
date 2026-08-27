import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  CareerPreferences,
  CareerProfile,
  Education,
  Experience,
  Profile,
  Project,
  ProfileSkillWithSkill,
} from "./types";

/**
 * Fetches the full career profile for the given user id. The id must come
 * from a verified session (see lib/auth/require-user.ts) — never trust a
 * client-supplied id. RLS also independently enforces that a query can
 * only ever return the calling user's own rows, regardless of what id is
 * passed here.
 */
export async function getCareerProfile(userId: string): Promise<CareerProfile | null> {
  const supabase = await createServerSupabaseClient();

  const [
    { data: profile },
    { data: skillRows },
    { data: education },
    { data: experience },
    { data: projects },
    { data: careerPreferences },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_skills")
      .select("id, proficiency, years_experience, skill:skills(*)")
      .eq("profile_id", userId),
    supabase
      .from("education")
      .select("*")
      .eq("profile_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("experience")
      .select("*")
      .eq("profile_id", userId)
      .order("start_date", { ascending: false }),
    supabase
      .from("projects")
      .select("*")
      .eq("profile_id", userId)
      .order("start_date", { ascending: false }),
    supabase.from("career_preferences").select("*").eq("profile_id", userId).maybeSingle(),
  ]);

  if (!profile) return null;

  // The Supabase clients aren't parameterized with a Database generic (see
  // the note in lib/supabase/client.ts), so query results come back
  // loosely typed. Cast them to the app's own types here, at the single
  // boundary where database rows become application data.
  return {
    profile: profile as Profile,
    skills: (skillRows ?? []) as unknown as ProfileSkillWithSkill[],
    education: (education ?? []) as Education[],
    experience: (experience ?? []) as Experience[],
    projects: (projects ?? []) as Project[],
    careerPreferences: (careerPreferences ?? null) as CareerPreferences | null,
  };
}
