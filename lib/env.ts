import "server-only";

/**
 * Reads and validates GEMINI_API_KEY. Throws a clear, non-sensitive error
 * if it's missing rather than letting the Gemini SDK fail with an opaque
 * auth error later.
 */
export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to .env.local (see .env.example)."
    );
  }
  return apiKey;
}
