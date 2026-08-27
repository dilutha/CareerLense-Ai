import type {
  CareerPreferenceEmploymentType,
  Database,
  EmploymentType,
  RemotePreference,
  SkillProficiency,
} from "@/lib/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];
export type Education = Database["public"]["Tables"]["education"]["Row"];
export type Experience = Database["public"]["Tables"]["experience"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type CareerPreferences = Database["public"]["Tables"]["career_preferences"]["Row"];

export interface ProfileSkillWithSkill {
  id: string;
  proficiency: SkillProficiency;
  years_experience: number | null;
  skill: Skill;
}

/** The full, composed career profile for one user. */
export interface CareerProfile {
  profile: Profile;
  skills: ProfileSkillWithSkill[];
  education: Education[];
  experience: Experience[];
  projects: Project[];
  careerPreferences: CareerPreferences | null;
}

export type {
  CareerPreferenceEmploymentType,
  EmploymentType,
  RemotePreference,
  SkillProficiency,
};
