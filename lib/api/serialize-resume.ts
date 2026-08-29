import type { ResumeWithAnalysis } from "@/lib/resume/types";

/**
 * Strips what /api/v1 must never expose (Part 5): the raw extracted CV
 * text (`version.extracted_text`) and the private Storage path
 * (`resume.storage_path` — not a public URL by itself, but kept out of
 * API responses regardless as defense in depth; a signed URL is still
 * only ever generated server-side per-request via the existing
 * `getResumeSignedUrl`, never returned here). Everything else —
 * structured analysis findings, parsed_data, scores — has no such
 * sensitivity and is returned as-is.
 */
export function serializeResumeForApi(item: ResumeWithAnalysis) {
  const resumeFields: Omit<ResumeWithAnalysis["resume"], "storage_path"> = { ...item.resume };
  delete (resumeFields as Partial<ResumeWithAnalysis["resume"]>).storage_path;

  let version: Omit<NonNullable<ResumeWithAnalysis["version"]>, "extracted_text"> | null = null;
  if (item.version) {
    version = { ...item.version };
    delete (version as Partial<NonNullable<ResumeWithAnalysis["version"]>>).extracted_text;
  }

  return {
    resume: resumeFields,
    version,
    analysis: item.analysis,
  };
}
