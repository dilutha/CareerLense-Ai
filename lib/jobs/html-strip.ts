const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&#160;": " ",
};

/**
 * Minimal HTML-to-plain-text conversion for provider descriptions that
 * arrive as HTML (e.g. ITPro.lk). Not a general-purpose sanitizer — output
 * is only ever used as plain text (job description storage, Gemini
 * analysis input), never re-rendered as HTML, so this doesn't need to
 * defend against XSS, just produce readable text without pulling in a new
 * dependency for something this small.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(li|p|br|div|h[1-6])[^>]*>/gi, "\n")
    .replace(/<\/(li|p|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (match) => ENTITY_MAP[match.toLowerCase()] ?? match)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
