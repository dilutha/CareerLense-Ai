import { canonicalizeSkill, hasEquivalentSkill } from "@/lib/jobs/skill-aliases";
import { findRelatedSkill } from "./related-skills";
import type { KeywordComparisonEntry, SkillComparisonEntry } from "./schemas";

export interface CandidateEvidence {
  /** Skills from the career profile + selected resume, de-duplicated. */
  skills: string[];
  /** Concatenated free text (project/experience descriptions, resume summary)
   *  used to tell "listed but unused" apart from "actually demonstrated". */
  evidenceText: string;
}

export interface JobRequirement {
  name: string;
  importance: "required" | "preferred" | "nice_to_have";
}

function isDemonstrated(skill: string, evidenceText: string): boolean {
  const canonical = canonicalizeSkill(skill);
  return evidenceText.toLowerCase().includes(canonical);
}

/**
 * Deterministic per-skill comparison — no Gemini involved. "strong_match"
 * requires the skill to be both listed and actually mentioned in project/
 * experience text (real evidence of use, not just a bullet-point list);
 * "partial" only fires for a small, controlled related-skill group (e.g.
 * Power BI for a Tableau requirement) — never a loose AI guess.
 */
export function compareSkills(
  jobRequirements: JobRequirement[],
  candidate: CandidateEvidence
): SkillComparisonEntry[] {
  return jobRequirements.map((req) => {
    const hasSkill = hasEquivalentSkill(req.name, candidate.skills);

    if (hasSkill) {
      const category = isDemonstrated(req.name, candidate.evidenceText)
        ? "strong_match"
        : "match";
      return { skill: req.name, category, importance: req.importance, relatedSkillFound: null };
    }

    if (candidate.skills.length === 0) {
      return {
        skill: req.name,
        category: "insufficient_evidence",
        importance: req.importance,
        relatedSkillFound: null,
      };
    }

    const related = findRelatedSkill(req.name, candidate.skills);
    if (related) {
      return { skill: req.name, category: "partial", importance: req.importance, relatedSkillFound: related };
    }

    return { skill: req.name, category: "missing", importance: req.importance, relatedSkillFound: null };
  });
}

/**
 * Deterministic keyword presence check — "weak" means the keyword appears
 * as a listed skill but isn't reinforced in project/experience text.
 */
export function compareKeywords(
  keywords: string[],
  candidate: CandidateEvidence
): { entries: KeywordComparisonEntry[]; overallAlignment: number } {
  if (keywords.length === 0) return { entries: [], overallAlignment: 100 };

  const entries: KeywordComparisonEntry[] = keywords.map((keyword) => {
    const listed = hasEquivalentSkill(keyword, candidate.skills);
    const demonstrated = isDemonstrated(keyword, candidate.evidenceText);

    let status: KeywordComparisonEntry["status"];
    if (listed && demonstrated) status = "present";
    else if (listed || demonstrated) status = "weak";
    else status = "missing";

    return { keyword, status };
  });

  const score = entries.reduce((sum, e) => sum + (e.status === "present" ? 1 : e.status === "weak" ? 0.5 : 0), 0);
  const overallAlignment = Math.round((score / entries.length) * 100);

  return { entries, overallAlignment };
}
