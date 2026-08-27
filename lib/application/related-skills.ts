import { canonicalizeSkill } from "@/lib/jobs/skill-aliases";

/**
 * Small, controlled groups of *related but not equivalent* skills — e.g.
 * Tableau and Power BI are both BI/data-viz tools, but having one is not
 * the same as having the other. Used only to detect "partial" matches
 * (PROJECT_SPEC.md's own Power BI/Tableau example) — never to claim the
 * candidate has the job's actual requirement.
 */
const RELATED_SKILL_GROUPS: string[][] = [
  ["tableau", "power bi", "looker", "qlik"],
  ["aws", "gcp", "azure"],
  ["mysql", "postgresql", "sql server", "sqlite", "oracle"],
  ["react", "vue", "angular", "svelte"],
  ["pytorch", "tensorflow", "keras"],
  ["docker", "kubernetes"],
  ["figma", "sketch", "adobe xd"],
];

/** The related skill (if any) the candidate has from `candidateSkills`, for a given target skill. */
export function findRelatedSkill(targetSkill: string, candidateSkills: string[]): string | null {
  const canonicalTarget = canonicalizeSkill(targetSkill);
  const group = RELATED_SKILL_GROUPS.find((g) => g.includes(canonicalTarget));
  if (!group) return null;

  const canonicalCandidates = candidateSkills.map(canonicalizeSkill);
  const match = group.find((s) => s !== canonicalTarget && canonicalCandidates.includes(s));
  if (!match) return null;

  const original = candidateSkills.find((s) => canonicalizeSkill(s) === match);
  return original ?? match;
}
