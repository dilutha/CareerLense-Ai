"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOptionalUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  CareerPreferenceEmploymentType,
  EmploymentType,
  RemotePreference,
  SkillProficiency,
} from "@/lib/supabase/types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

async function requireUserId(): Promise<string | null> {
  const user = await getOptionalUser();
  return user?.id ?? null;
}

function revalidateProfile() {
  revalidatePath("/profile");
  revalidatePath("/profile/setup");
}

const optionalText = (max: number) =>
  z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
    z.string().trim().max(max).optional()
  );

const optionalUrl = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (trimmed === "") return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string().url("That doesn't look like a valid URL.").max(300).optional());

const optionalDate = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional()
);

// ---------------------------------------------------------------------------
// Basic profile
// ---------------------------------------------------------------------------

const basicProfileSchema = z.object({
  full_name: z.string().trim().min(1, "Your name is required.").max(120),
  headline: optionalText(160),
  bio: optionalText(1000),
  location: optionalText(120),
  phone: optionalText(30),
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  portfolio_url: optionalUrl,
});

export async function updateBasicProfile(
  input: z.infer<typeof basicProfileSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = basicProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", userId);

  if (error) return { success: false, error: "Couldn't save your profile. Try again." };
  revalidateProfile();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

const educationSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required.").max(200),
  degree: optionalText(150),
  field_of_study: optionalText(150),
  start_date: optionalDate,
  end_date: optionalDate,
  is_current: z.boolean().prefault(false),
  description: optionalText(1000),
});

export async function addEducation(
  input: z.infer<typeof educationSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = educationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("education")
    .insert({ ...parsed.data, profile_id: userId });

  if (error) return { success: false, error: "Couldn't add that. Try again." };
  revalidateProfile();
  return { success: true };
}

export async function updateEducation(
  id: string,
  input: z.infer<typeof educationSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = educationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("education")
    .update(parsed.data)
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't save changes. Try again." };
  revalidateProfile();
  return { success: true };
}

export async function deleteEducation(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("education")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't delete that. Try again." };
  revalidateProfile();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

const EMPLOYMENT_TYPES: [EmploymentType, ...EmploymentType[]] = [
  "internship",
  "part_time",
  "full_time",
  "contract",
  "freelance",
  "volunteer",
  "other",
];

const experienceSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(200),
  role: z.string().trim().min(1, "Role is required.").max(200),
  employment_type: z.enum(EMPLOYMENT_TYPES).prefault("internship"),
  location: optionalText(150),
  start_date: optionalDate,
  end_date: optionalDate,
  is_current: z.boolean().prefault(false),
  description: optionalText(1000),
});

export async function addExperience(
  input: z.infer<typeof experienceSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("experience")
    .insert({ ...parsed.data, profile_id: userId });

  if (error) return { success: false, error: "Couldn't add that. Try again." };
  revalidateProfile();
  return { success: true };
}

export async function updateExperience(
  id: string,
  input: z.infer<typeof experienceSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("experience")
    .update(parsed.data)
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't save changes. Try again." };
  revalidateProfile();
  return { success: true };
}

export async function deleteExperience(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("experience")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't delete that. Try again." };
  revalidateProfile();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required.").max(200),
  description: optionalText(1000),
  project_url: optionalUrl,
  github_url: optionalUrl,
  start_date: optionalDate,
  end_date: optionalDate,
  is_current: z.boolean().prefault(false),
});

export async function addProject(input: z.infer<typeof projectSchema>): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, profile_id: userId });

  if (error) return { success: false, error: "Couldn't add that project. Try again." };
  revalidateProfile();
  return { success: true };
}

export async function updateProject(
  id: string,
  input: z.infer<typeof projectSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't save changes. Try again." };
  revalidateProfile();
  return { success: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't delete that. Try again." };
  revalidateProfile();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const PROFICIENCIES: [SkillProficiency, ...SkillProficiency[]] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

const addSkillSchema = z.object({
  skillName: z.string().trim().min(1, "Enter a skill name.").max(80),
  category: optionalText(40),
  proficiency: z.enum(PROFICIENCIES).prefault("intermediate"),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
});

export async function addProfileSkill(
  input: z.infer<typeof addSkillSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = addSkillSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { skillName, category, proficiency, yearsExperience } = parsed.data;

  const supabase = await createServerSupabaseClient();

  // Case-insensitive lookup-or-create so "Python" / "python" reuse one row.
  const { data: existing } = await supabase
    .from("skills")
    .select("id")
    .ilike("name", skillName)
    .maybeSingle();

  let skillId = existing?.id;

  if (!skillId) {
    const { data: created, error: createError } = await supabase
      .from("skills")
      .insert({ name: skillName, category: category || "other" })
      .select("id")
      .single();

    if (createError) {
      // Likely a concurrent insert of the same name — look it up again.
      const { data: retry } = await supabase
        .from("skills")
        .select("id")
        .ilike("name", skillName)
        .maybeSingle();
      if (!retry) return { success: false, error: "Couldn't save that skill. Try again." };
      skillId = retry.id;
    } else {
      skillId = created.id;
    }
  }

  const { error: linkError } = await supabase.from("profile_skills").insert({
    profile_id: userId,
    skill_id: skillId,
    proficiency,
    years_experience: yearsExperience ?? null,
  });

  if (linkError) {
    if (linkError.code === "23505") {
      return { success: false, error: "You've already added that skill." };
    }
    return { success: false, error: "Couldn't add that skill. Try again." };
  }

  revalidateProfile();
  return { success: true };
}

export async function removeProfileSkill(profileSkillId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("profile_skills")
    .delete()
    .eq("id", profileSkillId)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't remove that skill." };
  revalidateProfile();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Career preferences
// ---------------------------------------------------------------------------

const CAREER_EMPLOYMENT_TYPES: [CareerPreferenceEmploymentType, ...CareerPreferenceEmploymentType[]] = [
  "internship",
  "part_time",
  "full_time",
  "contract",
  "freelance",
  "any",
];
const REMOTE_PREFERENCES: [RemotePreference, ...RemotePreference[]] = [
  "remote",
  "hybrid",
  "on_site",
  "any",
];

const careerPreferencesSchema = z
  .object({
    target_role: optionalText(150),
    employment_type: z.enum(CAREER_EMPLOYMENT_TYPES).optional(),
    preferred_locations: z.array(z.string().trim().min(1).max(80)).max(10).prefault([]),
    remote_preference: z.enum(REMOTE_PREFERENCES).optional(),
    preferred_industries: z.array(z.string().trim().min(1).max(80)).max(10).prefault([]),
    minimum_salary: z.number().int().min(0).nullable().optional(),
    maximum_salary: z.number().int().min(0).nullable().optional(),
  })
  .refine(
    (data) =>
      data.minimum_salary == null ||
      data.maximum_salary == null ||
      data.minimum_salary <= data.maximum_salary,
    { message: "Minimum salary can't be higher than maximum.", path: ["minimum_salary"] }
  );

export async function updateCareerPreferences(
  input: z.infer<typeof careerPreferencesSchema>
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const parsed = careerPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("career_preferences")
    .upsert({ ...parsed.data, profile_id: userId }, { onConflict: "profile_id" });

  if (error) return { success: false, error: "Couldn't save your preferences. Try again." };
  revalidateProfile();
  return { success: true };
}
