/**
 * Resolves a 1-indexed ordinal ("second eka" -> 2) against the real job
 * IDs from the last batch actually shown — the only deterministic source
 * of truth for "which job" (Part 10: never let Gemini state or remember
 * an ID itself). Returns null for an out-of-range index or an empty
 * result list rather than guessing.
 */
export function resolveJobReference(referencedResultIndex: number | null, lastResultJobIds: string[]): string | null {
  if (referencedResultIndex === null) return null;
  const index = referencedResultIndex - 1;
  if (index < 0 || index >= lastResultJobIds.length) return null;
  return lastResultJobIds[index];
}
