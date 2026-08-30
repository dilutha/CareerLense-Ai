"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOptionalUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { extractResumeText, ScannedDocumentError } from "./extract-text";
import { parseAndEvaluateResume } from "./parse-resume";
import { buildResumeAnalysisRecord } from "./analyze-resume";
import { populateProfileFromResume } from "@/lib/career-profile/populate-from-resume";
import { getResumeById } from "./get-resumes";
import type { ResumeFileType } from "./types";

export interface ActionResult {
  success: boolean;
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = "resumes";

const ACCEPTED_TYPES: Record<string, ResumeFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "resume";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
  return cleaned || "resume";
}

function resolveFileType(file: File): ResumeFileType | null {
  const byMime = ACCEPTED_TYPES[file.type];
  if (byMime) return byMime;

  // Some browsers/OSes send an empty or generic content-type for DOCX —
  // fall back to the extension rather than rejecting a valid file.
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

async function requireUserId(): Promise<string | null> {
  const user = await getOptionalUser();
  return user?.id ?? null;
}

function revalidateResumeViews(resumeId?: string) {
  revalidatePath("/profile");
  if (resumeId) revalidatePath(`/resume/${resumeId}`);
}

// ---------------------------------------------------------------------------
// Upload — validates, uploads to private Storage, creates the DB record.
// Does NOT extract/analyze — call processResume() next.
// ---------------------------------------------------------------------------

export async function uploadResume(
  formData: FormData
): Promise<ActionResult & { resumeId?: string }> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file selected." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: "That file is too big — max 10 MB." };
  }

  const fileType = resolveFileType(file);
  if (!fileType) {
    return { success: false, error: "Only PDF or DOCX files are supported." };
  }

  const supabase = await createServerSupabaseClient();
  const resumeId = crypto.randomUUID();
  const safeName = sanitizeFilename(file.name);
  const storagePath = `${userId}/${resumeId}/${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    console.error("[resume] Storage upload failed:", uploadError.message);
    return { success: false, error: "Couldn't upload that file. Try again." };
  }

  const { error: insertError } = await supabase.from("resumes").insert({
    id: resumeId,
    profile_id: userId,
    name: safeName,
    original_filename: file.name.slice(0, 200),
    storage_path: storagePath,
    file_type: fileType,
    file_size: file.size,
    status: "uploaded",
  });

  if (insertError) {
    console.error("[resume] Insert failed after upload, cleaning up storage:", insertError.message);
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { success: false, error: "Couldn't save that resume. Try again." };
  }

  revalidateResumeViews();
  return { success: true, resumeId };
}

// ---------------------------------------------------------------------------
// Process — downloads the file, extracts text, calls Gemini, saves results.
// Separate from upload() so the UI can show "Uploaded" then "Reading your
// CV..." as two distinct steps, and so a failed analysis can be retried
// without re-uploading the file.
// ---------------------------------------------------------------------------

export async function processResume(resumeId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return processResumeCore(userId, supabase, resumeId);
}

/**
 * The real work, parameterized by an already-resolved user + Supabase
 * client — extracted so /api/v1/resumes/[id]/analyze (bearer-token
 * authenticated, no browser cookies) can run the SAME Gemini
 * extraction/scoring logic instead of reimplementing it. `processResume`
 * above is now a thin wrapper: resolve the cookie-based session, then
 * delegate here — its own behavior is unchanged.
 */
export async function processResumeCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  resumeId: string
): Promise<ActionResult> {
  const { data: resume } = await supabase
    .from("resumes")
    .select("id, profile_id, storage_path, file_type")
    .eq("id", resumeId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!resume) {
    return { success: false, error: "Couldn't find that resume." };
  }

  await supabase.from("resumes").update({ status: "processing" }).eq("id", resumeId);

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(resume.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? "Download returned no data.");
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const { text, truncated } = await extractResumeText(buffer, resume.file_type as ResumeFileType);

    const output = await parseAndEvaluateResume(text);

    const { data: version, error: versionError } = await supabase
      .from("resume_versions")
      .insert({
        resume_id: resumeId,
        version_number: 1,
        extracted_text: text,
        text_truncated: truncated,
        parsed_data: output.parsed,
      })
      .select("id")
      .single();

    if (versionError || !version) {
      throw new Error(versionError?.message ?? "Couldn't save the resume version.");
    }

    const analysisRecord = buildResumeAnalysisRecord(version.id, output);
    const { error: analysisError } = await supabase
      .from("resume_analysis")
      .insert(analysisRecord);

    if (analysisError) {
      throw new Error(analysisError.message);
    }

    // Best-effort — a failure here shouldn't fail the whole upload/analysis
    // (the resume_analysis row is already saved and usable); the profile
    // just won't be auto-populated from this CV this time.
    try {
      await populateProfileFromResume(supabase, userId, output.parsed);
    } catch (populateError) {
      console.error(
        `[resume] Profile auto-population failed for resume ${resumeId}:`,
        populateError instanceof Error ? populateError.message : String(populateError)
      );
    }

    await supabase
      .from("resumes")
      .update({ status: "ready", error_message: null })
      .eq("id", resumeId);

    revalidateResumeViews(resumeId);
    return { success: true };
  } catch (error) {
    const isScanned = error instanceof ScannedDocumentError;
    const message = isScanned
      ? "Looks like this CV is scanned as an image — I couldn't read enough text from it yet. Try a text-based PDF or DOCX."
      : "Something went wrong while reading your CV.";

    console.error(
      `[resume] Processing failed for resume ${resumeId}:`,
      error instanceof Error ? error.message : String(error)
    );

    await supabase
      .from("resumes")
      .update({ status: "failed", error_message: message })
      .eq("id", resumeId);

    revalidateResumeViews(resumeId);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Review summary — a compact, honest "here's what I found" for onboarding
// (Part 2), built from the same resume_analysis row already saved above.
// ---------------------------------------------------------------------------

export interface ResumeReviewSummary {
  skills: string[];
  educationSummary: string | null;
  experienceSummary: string | null;
  projectCount: number;
  suggestedTargetRole: string | null;
}

export async function getResumeReviewSummary(
  resumeId: string
): Promise<ActionResult & { summary?: ResumeReviewSummary }> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const withDetails = await getResumeById(userId, resumeId);
  if (!withDetails) return { success: false, error: "Couldn't find that resume." };
  if (!withDetails.analysis) return { success: false, error: "Still analyzing — try again in a moment." };

  const parsedExperience = (withDetails.version?.parsed_data as { experience?: { role: string }[] } | null)
    ?.experience;

  return {
    success: true,
    summary: {
      skills: withDetails.analysis.skills.map((s) => s.name),
      educationSummary: withDetails.analysis.education_summary,
      experienceSummary: withDetails.analysis.experience_summary,
      projectCount: withDetails.analysis.projects.length,
      suggestedTargetRole: parsedExperience?.[0]?.role ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteResume(resumeId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  return deleteResumeCore(userId, supabase, resumeId);
}

/** Extracted for /api/v1/resumes/[id] DELETE — see processResumeCore's comment for why. */
export async function deleteResumeCore(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  resumeId: string
): Promise<ActionResult> {
  const { data: resume } = await supabase
    .from("resumes")
    .select("id, storage_path")
    .eq("id", resumeId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!resume) {
    return { success: false, error: "Couldn't find that resume." };
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([resume.storage_path]);

  if (storageError) {
    console.error("[resume] Storage delete failed:", storageError.message);
    return { success: false, error: "Couldn't delete the file. Try again." };
  }

  const { error: deleteError } = await supabase
    .from("resumes")
    .delete()
    .eq("id", resumeId)
    .eq("profile_id", userId);

  if (deleteError) {
    console.error("[resume] DB delete failed after storage delete:", deleteError.message);
    return { success: false, error: "Couldn't delete that resume. Try again." };
  }

  revalidateResumeViews();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Default resume
// ---------------------------------------------------------------------------

export async function setDefaultResume(resumeId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();

  await supabase
    .from("resumes")
    .update({ is_default: false })
    .eq("profile_id", userId)
    .eq("is_default", true);

  const { error } = await supabase
    .from("resumes")
    .update({ is_default: true })
    .eq("id", resumeId)
    .eq("profile_id", userId);

  if (error) return { success: false, error: "Couldn't set that as your default resume." };
  revalidateResumeViews();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Signed URL for viewing the original file
// ---------------------------------------------------------------------------

export async function getResumeSignedUrl(
  resumeId: string
): Promise<ActionResult & { url?: string }> {
  const userId = await requireUserId();
  if (!userId) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, storage_path")
    .eq("id", resumeId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!resume) {
    return { success: false, error: "Couldn't find that resume." };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(resume.storage_path, 60);

  if (error || !data) {
    return { success: false, error: "Couldn't generate a link right now." };
  }

  return { success: true, url: data.signedUrl };
}
