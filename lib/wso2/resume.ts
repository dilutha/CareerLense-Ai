import "server-only";
import { callWso2 } from "./client";
import type { Resume, ResumeAnalysis, ResumeVersion } from "@/lib/resume/types";

interface Wso2SuccessEnvelope {
  success: true;
  [key: string]: unknown;
}

/** Matches lib/api/serialize-resume.ts's output exactly — never includes extracted_text or storage_path. */
export interface SerializedResume {
  resume: Omit<Resume, "storage_path">;
  version: Omit<ResumeVersion, "extracted_text"> | null;
  analysis: ResumeAnalysis | null;
}

export async function getResumesViaWso2(userAccessToken: string): Promise<SerializedResume[]> {
  const result = await callWso2<Wso2SuccessEnvelope & { resumes: SerializedResume[] }>("/resumes", {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.resumes;
}

export async function getResumeViaWso2(userAccessToken: string, resumeId: string): Promise<SerializedResume | null> {
  const result = await callWso2<Wso2SuccessEnvelope & { resume: SerializedResume | null }>(`/resumes/${resumeId}`, {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.resume;
}

export async function deleteResumeViaWso2(userAccessToken: string, resumeId: string): Promise<void> {
  await callWso2<Wso2SuccessEnvelope>(`/resumes/${resumeId}`, {
    method: "DELETE",
    userAccessToken,
  });
}

export async function getResumeAnalysisViaWso2(userAccessToken: string, resumeId: string): Promise<ResumeAnalysis> {
  const result = await callWso2<Wso2SuccessEnvelope & { analysis: ResumeAnalysis }>(`/resumes/${resumeId}/analysis`, {
    method: "GET",
    userAccessToken,
    retryOnFailure: true,
  });
  return result.analysis;
}

/** Gemini-powered — no retryOnFailure (never safe to retry a write/generation call) and a longer timeout than the default 10s. */
export async function analyzeResumeViaWso2(userAccessToken: string, resumeId: string): Promise<SerializedResume | null> {
  const result = await callWso2<Wso2SuccessEnvelope & { resume: SerializedResume | null }>(`/resumes/${resumeId}/analyze`, {
    method: "POST",
    userAccessToken,
    timeoutMs: 30_000,
  });
  return result.resume;
}
