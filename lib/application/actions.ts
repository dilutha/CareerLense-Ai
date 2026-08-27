"use server";

import { revalidatePath } from "next/cache";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getCareerProfile } from "@/lib/career-profile/get-profile";
import { getResumeById } from "@/lib/resume/get-resumes";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Job, JobSkillRow } from "@/lib/jobs/types";
import type { JobAnalysis } from "@/lib/jobs/schemas";
import { compareKeywords, compareSkills, type JobRequirement } from "./compare";
import { generateCoverLetter } from "./generate-cover-letter";
import { tailorResume } from "./tailor-resume";
import { buildVerifiedFacts, verifiedFactsToEvidenceText } from "./verified-facts";
import type {
  ApplicationAnalysisRow,
  ApplicationDocument,
  ApplicationDocumentVersion,
  CoverLetterRow,
} from "./types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

async function requireUserId(): Promise<string | null> {
  const user = await getOptionalUser();
  return user?.id ?? null;
}

function revalidateApplication(jobId: string) {
  revalidatePath(`/application/${jobId}`);
  revalidatePath(`/jobs/${jobId}`);
}

function extractJobAnalysis(job: Job): JobAnalysis | null {
  const data = job.normalized_data as { analysis?: JobAnalysis } | null;
  return data?.analysis ?? null;
}

/**
 * Ensures an application_documents row exists for (user, job), created
 * from the given resume. If one already exists, its source_resume_id is
 * updated (switching resumes doesn't create a duplicate application).
 */
export async function getOrCreateApplication(
  jobId: string,
  resumeId: string
): Promise<ActionResult & { documentId?: string }> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const resume = await getResumeById(userId, resumeId);
  if (!resume || resume.resume.status !== "ready") {
    return {
      success: false,
      error: "Machan, me CV eka tailor karanna mama oyage ready CV ekak one. Upload karala balamu.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("application_documents")
    .upsert(
      { profile_id: userId, job_id: jobId, source_resume_id: resumeId },
      { onConflict: "profile_id,job_id" }
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error("[application] getOrCreateApplication failed:", error?.message);
    return { success: false, error: "Couldn't start this application. Try again." };
  }

  revalidateApplication(jobId);
  return { success: true, documentId: (data as { id: string }).id };
}

/**
 * Deterministic resume-vs-job comparison (no Gemini) — see
 * lib/application/compare.ts. Safe to re-run any time.
 */
export async function runApplicationAnalysis(documentId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();

  const { data: doc } = await supabase
    .from("application_documents")
    .select("*")
    .eq("id", documentId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!doc) return { success: false, error: "Couldn't find that application." };
  const document = doc as ApplicationDocument;

  const [{ data: job }, { data: jobSkills }, profile, resume] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", document.job_id).maybeSingle(),
    supabase.from("job_skills").select("*").eq("job_id", document.job_id),
    getCareerProfile(userId),
    getResumeById(userId, document.source_resume_id),
  ]);

  if (!job) return { success: false, error: "This job listing is no longer available." };

  const jobRow = job as Job;
  if (!jobRow.description || jobRow.description.trim().length < 50) {
    return {
      success: false,
      error:
        "Me job posting eke description eka godak adui — keyword analysis eka reliable widihata karanna amarui.",
    };
  }

  const facts = buildVerifiedFacts(profile, resume?.version ?? null);
  const evidenceText = verifiedFactsToEvidenceText(facts);

  const requirements: JobRequirement[] = ((jobSkills ?? []) as JobSkillRow[]).map((s) => ({
    name: s.skill_name,
    importance: s.importance,
  }));

  const skillComparison = compareSkills(requirements, { skills: facts.skills, evidenceText });
  const jobAnalysis = extractJobAnalysis(jobRow);
  const { entries: keywordComparison, overallAlignment } = compareKeywords(
    jobAnalysis?.keywords ?? [],
    { skills: facts.skills, evidenceText }
  );

  const { error } = await supabase.from("application_analyses").upsert(
    {
      application_document_id: documentId,
      profile_id: userId,
      skill_comparison: skillComparison,
      keyword_comparison: keywordComparison,
      overall_keyword_alignment: overallAlignment,
    },
    { onConflict: "application_document_id" }
  );

  if (error) {
    console.error("[application] Saving analysis failed:", error.message);
    return { success: false, error: "Couldn't analyze this application. Try again." };
  }

  revalidateApplication(document.job_id);
  return { success: true };
}

export async function generateTailoredCv(documentId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();

  const [{ data: doc }, { data: existingVersions }] = await Promise.all([
    supabase.from("application_documents").select("*").eq("id", documentId).eq("profile_id", userId).maybeSingle(),
    supabase
      .from("application_document_versions")
      .select("version_number")
      .eq("application_document_id", documentId)
      .order("version_number", { ascending: false })
      .limit(1),
  ]);

  if (!doc) return { success: false, error: "Couldn't find that application." };
  const document = doc as ApplicationDocument;

  const [{ data: job }, { data: analysis }, profile, resume] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", document.job_id).maybeSingle(),
    supabase
      .from("application_analyses")
      .select("overall_keyword_alignment")
      .eq("application_document_id", documentId)
      .maybeSingle(),
    getCareerProfile(userId),
    getResumeById(userId, document.source_resume_id),
  ]);

  if (!job) return { success: false, error: "This job listing is no longer available." };

  const jobRow = job as Job;
  const facts = buildVerifiedFacts(profile, resume?.version ?? null);

  try {
    const output = await tailorResume(jobRow, extractJobAnalysis(jobRow), facts);

    const nextVersion =
      ((existingVersions?.[0] as { version_number: number } | undefined)?.version_number ?? 0) + 1;

    const evidenceText = verifiedFactsToEvidenceText({
      ...facts,
      skills: output.tailoredContent.skills,
    });
    const jobAnalysis = extractJobAnalysis(jobRow);
    const { overallAlignment: keywordAlignmentAfter } = compareKeywords(
      jobAnalysis?.keywords ?? [],
      { skills: output.tailoredContent.skills, evidenceText }
    );

    const { error } = await supabase.from("application_document_versions").insert({
      application_document_id: documentId,
      profile_id: userId,
      version_number: nextVersion,
      tailored_content: output.tailoredContent,
      tailoring_notes: output.notes,
      keyword_alignment_before:
        (analysis as { overall_keyword_alignment: number | null } | null)?.overall_keyword_alignment ?? null,
      keyword_alignment_after: keywordAlignmentAfter,
    });

    if (error) {
      console.error("[application] Saving tailored CV failed:", error.message);
      return { success: false, error: "Couldn't save the tailored CV. Try again." };
    }

    await supabase.from("application_documents").update({ status: "ready" }).eq("id", documentId);
    revalidateApplication(document.job_id);
    return { success: true };
  } catch (error) {
    console.error(
      "[application] Tailoring failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Something went wrong while tailoring your CV. Try again." };
  }
}

export async function generateCoverLetterForApplication(documentId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();

  const [{ data: doc }, { data: existing }] = await Promise.all([
    supabase.from("application_documents").select("*").eq("id", documentId).eq("profile_id", userId).maybeSingle(),
    supabase
      .from("cover_letters")
      .select("version_number")
      .eq("application_document_id", documentId)
      .order("version_number", { ascending: false })
      .limit(1),
  ]);

  if (!doc) return { success: false, error: "Couldn't find that application." };
  const document = doc as ApplicationDocument;

  const [{ data: job }, profile, resume] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", document.job_id).maybeSingle(),
    getCareerProfile(userId),
    getResumeById(userId, document.source_resume_id),
  ]);

  if (!job) return { success: false, error: "This job listing is no longer available." };

  const facts = buildVerifiedFacts(profile, resume?.version ?? null);

  try {
    const content = await generateCoverLetter(job as Job, facts);
    const nextVersion =
      ((existing?.[0] as { version_number: number } | undefined)?.version_number ?? 0) + 1;

    const { error } = await supabase.from("cover_letters").insert({
      application_document_id: documentId,
      profile_id: userId,
      version_number: nextVersion,
      content,
    });

    if (error) {
      console.error("[application] Saving cover letter failed:", error.message);
      return { success: false, error: "Couldn't save the cover letter. Try again." };
    }

    revalidateApplication(document.job_id);
    return { success: true };
  } catch (error) {
    console.error(
      "[application] Cover letter generation failed:",
      error instanceof Error ? error.message : String(error)
    );
    return { success: false, error: "Something went wrong while writing your cover letter. Try again." };
  }
}

export type { ApplicationAnalysisRow, ApplicationDocument, ApplicationDocumentVersion, CoverLetterRow };
