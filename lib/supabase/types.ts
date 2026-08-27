/**
 * Hand-authored types matching supabase/migrations/001_initial_career_profile.sql
 * and 002_resume_intelligence.sql. The `resumes` / `resume_versions` /
 * `resume_analysis` row shapes live in lib/resume/types.ts instead of here,
 * since lib/resume/ owns that domain end-to-end — see that file.
 *
 * Once the migrations have been applied to your Supabase project,
 * regenerate this file from the real schema instead of maintaining it by
 * hand:
 *
 *   supabase gen types typescript --project-id <project-id> > lib/supabase/types.ts
 */

export type SkillProficiency = "beginner" | "intermediate" | "advanced" | "expert";

export type EmploymentType =
  | "internship"
  | "part_time"
  | "full_time"
  | "contract"
  | "freelance"
  | "volunteer"
  | "other";

export type CareerPreferenceEmploymentType =
  | "internship"
  | "part_time"
  | "full_time"
  | "contract"
  | "freelance"
  | "any";

export type RemotePreference = "remote" | "hybrid" | "on_site" | "any";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          headline: string | null;
          bio: string | null;
          location: string | null;
          phone: string | null;
          linkedin_url: string | null;
          github_url: string | null;
          portfolio_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["profiles"]["Row"], "id">> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      skills: {
        Row: {
          id: string;
          name: string;
          category: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["skills"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["skills"]["Row"]>;
      };
      profile_skills: {
        Row: {
          id: string;
          profile_id: string;
          skill_id: string;
          proficiency: SkillProficiency;
          years_experience: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profile_skills"]["Row"]> & {
          profile_id: string;
          skill_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_skills"]["Row"]>;
      };
      education: {
        Row: {
          id: string;
          profile_id: string;
          institution: string;
          degree: string | null;
          field_of_study: string | null;
          start_date: string | null;
          end_date: string | null;
          is_current: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["education"]["Row"]> & {
          profile_id: string;
          institution: string;
        };
        Update: Partial<Database["public"]["Tables"]["education"]["Row"]>;
      };
      experience: {
        Row: {
          id: string;
          profile_id: string;
          company: string;
          role: string;
          employment_type: EmploymentType;
          location: string | null;
          start_date: string | null;
          end_date: string | null;
          is_current: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["experience"]["Row"]> & {
          profile_id: string;
          company: string;
          role: string;
        };
        Update: Partial<Database["public"]["Tables"]["experience"]["Row"]>;
      };
      projects: {
        Row: {
          id: string;
          profile_id: string;
          name: string;
          description: string | null;
          project_url: string | null;
          github_url: string | null;
          start_date: string | null;
          end_date: string | null;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & {
          profile_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
      };
      career_preferences: {
        Row: {
          id: string;
          profile_id: string;
          target_role: string | null;
          employment_type: CareerPreferenceEmploymentType | null;
          preferred_locations: string[];
          remote_preference: RemotePreference | null;
          preferred_industries: string[];
          minimum_salary: number | null;
          maximum_salary: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["career_preferences"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["career_preferences"]["Row"]>;
      };
    };
  };
}
