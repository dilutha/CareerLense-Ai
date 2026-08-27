import "server-only";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import type { ResumeFileType } from "./types";

/** Below this many characters, treat the PDF as scanned/image-only. */
const MIN_MEANINGFUL_TEXT_LENGTH = 200;

/** Cap sent to Gemini — well within context limits, keeps requests cheap. */
export const MAX_RESUME_TEXT_LENGTH = 20_000;

export class ScannedDocumentError extends Error {
  constructor() {
    super("This document appears to be scanned/image-only — little to no extractable text.");
    this.name = "ScannedDocumentError";
  }
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractPdfText(pdf, { mergePages: true });
  return text;
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/**
 * Extracts and normalizes text from an uploaded resume file. Throws
 * ScannedDocumentError if a PDF produces too little text to be useful
 * (image-only scan) — callers should surface this as a friendly,
 * non-fabricated failure rather than silently analyzing a blank document.
 */
export async function extractResumeText(
  buffer: Buffer,
  fileType: ResumeFileType
): Promise<{ text: string; truncated: boolean }> {
  const raw = fileType === "pdf" ? await extractFromPdf(buffer) : await extractFromDocx(buffer);
  const normalized = normalizeText(raw);

  if (fileType === "pdf" && normalized.length < MIN_MEANINGFUL_TEXT_LENGTH) {
    throw new ScannedDocumentError();
  }

  if (normalized.length <= MAX_RESUME_TEXT_LENGTH) {
    return { text: normalized, truncated: false };
  }

  return { text: normalized.slice(0, MAX_RESUME_TEXT_LENGTH), truncated: true };
}
