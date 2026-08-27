import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Resume, ResumeAnalysis, ResumeVersion, ResumeWithAnalysis } from "./types";

async function attachLatestVersionAndAnalysis(
  resumes: Resume[]
): Promise<ResumeWithAnalysis[]> {
  if (resumes.length === 0) return [];

  const supabase = await createServerSupabaseClient();
  const resumeIds = resumes.map((r) => r.id);

  const { data: versions } = await supabase
    .from("resume_versions")
    .select("*")
    .in("resume_id", resumeIds)
    .order("version_number", { ascending: false });

  const latestVersionByResume = new Map<string, ResumeVersion>();
  for (const version of (versions ?? []) as ResumeVersion[]) {
    if (!latestVersionByResume.has(version.resume_id)) {
      latestVersionByResume.set(version.resume_id, version);
    }
  }

  const versionIds = [...latestVersionByResume.values()].map((v) => v.id);
  const analysisByVersion = new Map<string, ResumeAnalysis>();

  if (versionIds.length > 0) {
    const { data: analyses } = await supabase
      .from("resume_analysis")
      .select("*")
      .in("resume_version_id", versionIds)
      .order("created_at", { ascending: false });

    for (const analysis of (analyses ?? []) as ResumeAnalysis[]) {
      if (!analysisByVersion.has(analysis.resume_version_id)) {
        analysisByVersion.set(analysis.resume_version_id, analysis);
      }
    }
  }

  return resumes.map((resume) => {
    const version = latestVersionByResume.get(resume.id) ?? null;
    return {
      resume,
      version,
      analysis: version ? analysisByVersion.get(version.id) ?? null : null,
    };
  });
}

export async function getResumesForUser(userId: string): Promise<ResumeWithAnalysis[]> {
  const supabase = await createServerSupabaseClient();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("*")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });

  return attachLatestVersionAndAnalysis((resumes ?? []) as Resume[]);
}

export async function getResumeById(
  userId: string,
  resumeId: string
): Promise<ResumeWithAnalysis | null> {
  const supabase = await createServerSupabaseClient();

  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!resume) return null;

  const [withDetails] = await attachLatestVersionAndAnalysis([resume as Resume]);
  return withDetails ?? { resume: resume as Resume, version: null, analysis: null };
}

/** The user's default resume, if any — used for chat context and future job matching. */
export async function getDefaultResume(userId: string): Promise<ResumeWithAnalysis | null> {
  const supabase = await createServerSupabaseClient();

  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("profile_id", userId)
    .eq("is_default", true)
    .eq("status", "ready")
    .maybeSingle();

  if (resume) {
    const [withDetails] = await attachLatestVersionAndAnalysis([resume as Resume]);
    return withDetails ?? null;
  }

  // No explicit default — fall back to the most recently ready resume.
  const { data: fallback } = await supabase
    .from("resumes")
    .select("*")
    .eq("profile_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fallback) return null;
  const [withDetails] = await attachLatestVersionAndAnalysis([fallback as Resume]);
  return withDetails ?? null;
}
