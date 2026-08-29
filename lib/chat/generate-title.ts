const MAX_TITLE_LENGTH = 48;
const FALLBACK_TITLE = "New chat";

/**
 * Deterministic conversation title from the first user message — no
 * Gemini call. A genuinely semantic summary ("WSO2 Application", "CV
 * Improvement") would need an LLM call on every new conversation just for
 * a sidebar label; this project's established pattern is to spend a
 * Gemini call only where it adds real value (see e.g.
 * lib/learning/generate-roadmap.ts's narration-only Gemini use). A
 * cleaned-up truncation is free, instant, and the user can always rename
 * it (Part 19 explicitly requires that escape hatch anyway).
 */
export function generateConversationTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.trim().replace(/\s+/g, " ");
  if (!cleaned) return FALLBACK_TITLE;

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (capitalized.length <= MAX_TITLE_LENGTH) return capitalized;

  const truncated = capitalized.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > MAX_TITLE_LENGTH * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut.trimEnd()}…`;
}
