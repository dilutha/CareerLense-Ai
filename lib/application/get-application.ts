import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ApplicationAnalysisRow,
  ApplicationBundle,
  ApplicationDocument,
  ApplicationDocumentVersion,
  CoverLetterRow,
} from "./types";

export async function getApplicationBundle(userId: string, jobId: string): Promise<ApplicationBundle> {
  const supabase = await createServerSupabaseClient();

  const { data: doc } = await supabase
    .from("application_documents")
    .select("*")
    .eq("job_id", jobId)
    .eq("profile_id", userId)
    .maybeSingle();

  const document = (doc as ApplicationDocument | null) ?? null;

  if (!document) {
    return {
      document: null,
      analysis: null,
      latestCvVersion: null,
      cvVersionHistory: [],
      latestCoverLetter: null,
      coverLetterHistory: [],
    };
  }

  const [{ data: analysis }, { data: cvVersions }, { data: coverLetters }] = await Promise.all([
    supabase
      .from("application_analyses")
      .select("*")
      .eq("application_document_id", document.id)
      .maybeSingle(),
    supabase
      .from("application_document_versions")
      .select("*")
      .eq("application_document_id", document.id)
      .order("version_number", { ascending: false }),
    supabase
      .from("cover_letters")
      .select("*")
      .eq("application_document_id", document.id)
      .order("version_number", { ascending: false }),
  ]);

  const cvVersionHistory = (cvVersions ?? []) as ApplicationDocumentVersion[];
  const coverLetterHistory = (coverLetters ?? []) as CoverLetterRow[];

  return {
    document,
    analysis: (analysis as ApplicationAnalysisRow | null) ?? null,
    latestCvVersion: cvVersionHistory[0] ?? null,
    cvVersionHistory,
    latestCoverLetter: coverLetterHistory[0] ?? null,
    coverLetterHistory,
  };
}
