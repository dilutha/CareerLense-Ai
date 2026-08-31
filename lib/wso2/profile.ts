import "server-only";
import { callWso2 } from "./client";
import type {
  CareerPreferences,
  CareerProfile,
  Education,
  Experience,
  Profile,
  ProfileSkillWithSkill,
  Project,
} from "@/lib/career-profile/types";

interface Wso2SuccessEnvelope {
  success: true;
  [key: string]: unknown;
}

export interface Wso2HealthResult {
  service: string;
  api: string;
  status: string;
  timestamp: string;
}

/** No user context needed — proves the gateway itself is reachable and the API key is valid. */
export async function healthCheckViaWso2(): Promise<Wso2HealthResult> {
  const result = await callWso2<Wso2SuccessEnvelope & Wso2HealthResult>("/health", {
    method: "GET",
  });
  const { service, api, status, timestamp } = result;
  return { service, api, status, timestamp };
}

/**
 * Fetches the authenticated user's career profile through the WSO2
 * gateway -> this app's own /api/v1/profile route -> Supabase. Requires
 * the caller's real Supabase access token (not the WSO2 key alone) —
 * see client.ts's header comment for why both travel on this request.
 */
export async function getProfileViaWso2(userAccessToken: string): Promise<CareerProfile | null> {
  const result = await callWso2<Wso2SuccessEnvelope & { profile: CareerProfile | null }>("/profile", {
    method: "GET",
    userAccessToken,
  });
  return result.profile;
}

/** Matches app/api/v1/profile/route.ts PUT's own request schema exactly — kept in sync manually, same as the route's own Zod schema does with the DB columns. */
export interface UpdateProfileViaWso2Input {
  full_name?: string;
  headline?: string;
  bio?: string;
  location?: string;
  phone?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  target_role?: string;
  employment_type?: "internship" | "part_time" | "full_time" | "contract" | "freelance" | "any";
  remote_preference?: "remote" | "hybrid" | "on_site" | "any";
  preferred_locations?: string[];
  preferred_industries?: string[];
  minimum_salary?: number | null;
  maximum_salary?: number | null;
}

export async function updateProfileViaWso2(
  userAccessToken: string,
  input: UpdateProfileViaWso2Input
): Promise<CareerProfile | null> {
  const result = await callWso2<Wso2SuccessEnvelope & { profile: CareerProfile | null }>("/profile", {
    method: "PUT",
    userAccessToken,
    body: input,
  });
  return result.profile;
}

export async function getSkillsViaWso2(userAccessToken: string): Promise<ProfileSkillWithSkill[]> {
  const result = await callWso2<Wso2SuccessEnvelope & { skills: ProfileSkillWithSkill[] }>("/profile/skills", {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.skills;
}

export async function getEducationViaWso2(userAccessToken: string): Promise<Education[]> {
  const result = await callWso2<Wso2SuccessEnvelope & { education: Education[] }>("/profile/education", {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.education;
}

export async function getExperienceViaWso2(userAccessToken: string): Promise<Experience[]> {
  const result = await callWso2<Wso2SuccessEnvelope & { experience: Experience[] }>("/profile/experience", {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.experience;
}

export async function getProjectsViaWso2(userAccessToken: string): Promise<Project[]> {
  const result = await callWso2<Wso2SuccessEnvelope & { projects: Project[] }>("/profile/projects", {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.projects;
}

/** Closes a real gap found this session: `/profile/preferences` is defined in docs/openapi.yaml and already implemented at app/api/v1/profile/preferences/route.ts, but had no WSO2 client function at all. */
export async function getPreferencesViaWso2(userAccessToken: string): Promise<CareerPreferences | null> {
  const result = await callWso2<Wso2SuccessEnvelope & { preferences: CareerPreferences | null }>("/profile/preferences", {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.preferences;
}

// Re-exported so callers only need to import from lib/wso2/profile.ts, not
// also lib/career-profile/types.ts, for the types these functions return.
export type { CareerPreferences, CareerProfile, Education, Experience, Profile, ProfileSkillWithSkill, Project };
