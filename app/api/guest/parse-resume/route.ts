import { NextResponse } from "next/server";
import { ScannedDocumentError, extractResumeText } from "@/lib/resume/extract-text";
import { parseAndEvaluateResume } from "@/lib/resume/parse-resume";
import type { ResumeFileType } from "@/lib/resume/types";

/**
 * Guest CV upload — "temporary processing" per Part 7. Reuses the exact
 * same extraction + Gemini parsing pipeline as the authenticated resume
 * flow (lib/resume/extract-text.ts, lib/resume/parse-resume.ts), but never
 * touches Supabase Storage or any database table: the file's bytes and the
 * parsed result live only in this request/response — nothing persists,
 * nothing is attributable to any user, no profile_id/user_id involved.
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, same cap as authenticated upload
const ACCEPTED_TYPES: Record<string, ResumeFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function resolveFileType(file: File): ResumeFileType | null {
  const byMime = ACCEPTED_TYPES[file.type];
  if (byMime) return byMime;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  return null;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file selected." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "That file is too big — max 10 MB." }, { status: 413 });
  }

  const fileType = resolveFileType(file);
  if (!fileType) {
    return NextResponse.json({ error: "Only PDF or DOCX files are supported." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text } = await extractResumeText(buffer, fileType);
    const parsed = await parseAndEvaluateResume(text);

    return NextResponse.json({
      skills: parsed.parsed.skills.map((s) => s.name),
      targetRole: parsed.parsed.experience[0]?.role ?? null,
      education: parsed.parsed.education,
      experience: parsed.parsed.experience,
      projects: parsed.parsed.projects,
      certifications: parsed.parsed.certifications,
      summary: parsed.summary,
    });
  } catch (error) {
    if (error instanceof ScannedDocumentError) {
      return NextResponse.json(
        { error: "That file looks like a scanned image — I can't read text from it. Try a text-based PDF or DOCX." },
        { status: 422 }
      );
    }
    console.error("[guest/parse-resume] failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Couldn't read that CV right now. You can tell me about your experience in chat instead." },
      { status: 502 }
    );
  }
}
