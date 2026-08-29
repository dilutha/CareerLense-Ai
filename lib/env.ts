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

/**
 * Reads SERPAPI_API_KEY. Unlike Gemini's key, this is optional — the
 * SerpApi provider degrades to `configuration_required` (not an error)
 * when unset, so this returns null rather than throwing.
 */
export function getSerpApiKey(): string | null {
  const apiKey = process.env.SERPAPI_API_KEY;
  return apiKey && apiKey.trim().length > 0 ? apiKey : null;
}
