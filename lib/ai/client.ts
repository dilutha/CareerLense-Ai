import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "@/lib/env";

let client: GoogleGenAI | null = null;

/**
 * Lazily-constructed, server-only Gemini client singleton. Lazy so that
 * importing this module never throws — only calling it does, which keeps
 * build-time module evaluation safe even if the env var isn't set yet.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }
  return client;
}
