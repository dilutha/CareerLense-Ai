import { JOB_MATCH_WEIGHTS } from "./config";
import { scoreRoleAlignment } from "./role-taxonomy";
import { canonicalizeSkill, hasEquivalentSkill } from "./skill-aliases";
import type { JobEmploymentType, MatchExplanation } from "./types";

export interface MatchCandidateInput {
  /** Skills from the career profile. */
  profileSkills: string[];
  /** Skills detected in the candidate's default/most recent ready resume, if any. */
  resumeSkills: string[];
  targetRole: string | null;
  /** Degree/field names from education entries. */
  educationDegrees: string[];
  hasProfessionalExperience: boolean;
  projectCount: number;
  preferredLocations: string[];
  remotePreference: string | null;
}

export interface MatchJobInput {
  title: string;
  location: string | null;
  workMode: "onsite" | "hybrid" | "remote" | null;
  employmentType: JobEmploymentType | null;
  requiredSkills: string[];
  preferredSkills: string[];
  keywords: string[];
  educationRequirements: string[];
  experienceLevel: string | null;
}

export interface MatchResult {
  overall: number;
  skillsScore: number;
  roleScore: number;
  experienceScore: number;
  educationScore: number;
  locationScore: number;
  keywordScore: number;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  explanation: MatchExplanation;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function scoreSkills(
  candidateSkills: string[],
  required: string[],
  preferred: string[]
): { score: number; matched: string[]; missingRequired: string[]; missingPreferred: string[] } {
  const matchedRequired = required.filter((s) => hasEquivalentSkill(s, candidateSkills));
  const matchedPreferred = preferred.filter((s) => hasEquivalentSkill(s, candidateSkills));
  const missingRequired = required.filter((s) => !hasEquivalentSkill(s, candidateSkills));
  const missingPreferred = preferred.filter((s) => !hasEquivalentSkill(s, candidateSkills));

  let score: number;
  if (required.length === 0 && preferred.length === 0) {
    score = 100; // nothing to compare against — don't penalize
  } else if (required.length === 0) {
    score = (matchedPreferred.length / preferred.length) * 100;
  } else {
    const requiredRatio = matchedRequired.length / required.length;
    const preferredRatio = preferred.length > 0 ? matchedPreferred.length / preferred.length : 1;
    score = requiredRatio * 80 + preferredRatio * 20;
  }

  return {
    score: clamp(score),
    matched: [...matchedRequired, ...matchedPreferred],
    missingRequired,
    missingPreferred,
  };
}

function scoreExperience(
  candidate: MatchCandidateInput,
  job: MatchJobInput
): number {
  const isEntryFriendly =
    job.employmentType === "internship" ||
    job.experienceLevel === "internship" ||
    job.experienceLevel === "entry_level" ||
    job.experienceLevel === "graduate";

  if (isEntryFriendly) {
    // Internships/entry-level roles exist FOR people without professional
    // experience — never punish a candidate for that here.
    if (candidate.hasProfessionalExperience || candidate.projectCount >= 1) return 100;
    return 75;
  }

  if (candidate.hasProfessionalExperience) return 100;
  if (candidate.projectCount >= 2) return 75;
  if (candidate.projectCount >= 1) return 60;

  // No professional experience and no projects for a role that expects
  // some — a real gap, but never zero (PROJECT_SPEC.md §147).
  return job.experienceLevel === "senior" ? 30 : 45;
}

function scoreEducation(candidate: MatchCandidateInput, job: MatchJobInput): number {
  if (job.educationRequirements.length === 0) return 100;
  if (candidate.educationDegrees.length === 0) return 50;

  const candidateText = candidate.educationDegrees.join(" ").toLowerCase();
  const matches = job.educationRequirements.some((req) => {
    const tokens = req.toLowerCase().split(/[\s,/]+/).filter((t) => t.length > 3);
    return tokens.some((token) => candidateText.includes(token));
  });

  return matches ? 100 : 55;
}

function normalizeLocation(location: string): string {
  return location.trim().toLowerCase().replace(/\s*\d+$/, ""); // "Colombo 03" -> "colombo"
}

function scoreLocation(candidate: MatchCandidateInput, job: MatchJobInput): number {
  if (job.workMode === "remote") return 100;

  if (candidate.remotePreference === "any") return 85;
  if (candidate.preferredLocations.length === 0) return 70; // no stated preference — neutral

  if (!job.location) return 60;
  const jobLoc = normalizeLocation(job.location);
  const matches = candidate.preferredLocations.some(
    (loc) => normalizeLocation(loc) === jobLoc || jobLoc.includes(normalizeLocation(loc))
  );

  return matches ? 100 : 40;
}

function scoreKeywords(
  candidateSignals: string[],
  keywords: string[]
): { score: number; matched: string[]; missing: string[] } {
  if (keywords.length === 0) return { score: 100, matched: [], missing: [] };

  const canonicalSignals = candidateSignals.map(canonicalizeSkill);
  const matched = keywords.filter((kw) => canonicalSignals.includes(canonicalizeSkill(kw)));
  const missing = keywords.filter((kw) => !canonicalSignals.includes(canonicalizeSkill(kw)));

  return { score: clamp((matched.length / keywords.length) * 100), matched, missing };
}

function buildExplanation(
  scores: Omit<MatchResult, "explanation" | "matchedSkills" | "missingRequiredSkills" | "missingPreferredSkills" | "matchedKeywords" | "missingKeywords">,
  matchedSkills: string[],
  missingRequired: string[],
  missingPreferred: string[]
): MatchExplanation {
  const positives: string[] = [];
  const gaps: string[] = [];

  if (matchedSkills.length > 0) {
    positives.push(`Matches on ${matchedSkills.slice(0, 4).join(", ")}`);
  }
  if (scores.roleScore >= 90) positives.push("Strong role alignment");
  if (scores.educationScore >= 90) positives.push("Education matches what's asked for");
  if (scores.locationScore >= 90) positives.push("Location/work mode fits your preferences");
  if (scores.experienceScore >= 90) positives.push("Your experience level fits this role");

  if (missingRequired.length > 0) {
    gaps.push(`Missing required: ${missingRequired.slice(0, 4).join(", ")}`);
  }
  if (missingPreferred.length > 0) {
    gaps.push(`Missing preferred: ${missingPreferred.slice(0, 4).join(", ")}`);
  }
  if (scores.locationScore < 60) gaps.push("Location doesn't match your stated preferences");
  if (scores.educationScore < 60) gaps.push("Education requirement isn't clearly matched");

  return { positives, gaps };
}

/**
 * Deterministic, explainable job match. AI is used elsewhere (job
 * analysis, conversational explanation) but never to produce the score
 * itself — see docs/AI_AGENT.md for the full rationale.
 */
export function computeJobMatch(candidate: MatchCandidateInput, job: MatchJobInput): MatchResult {
  const candidateSkills = [...candidate.profileSkills, ...candidate.resumeSkills];

  const skills = scoreSkills(candidateSkills, job.requiredSkills, job.preferredSkills);
  const roleScore = scoreRoleAlignment(candidate.targetRole, job.title);
  const experienceScore = scoreExperience(candidate, job);
  const educationScore = scoreEducation(candidate, job);
  const locationScore = scoreLocation(candidate, job);
  const keywordSignals = [...candidateSkills, candidate.targetRole ?? ""].filter(Boolean);
  const keywordResult = scoreKeywords(keywordSignals, job.keywords);

  const overall = clamp(
    skills.score * JOB_MATCH_WEIGHTS.skills +
      roleScore * JOB_MATCH_WEIGHTS.role +
      experienceScore * JOB_MATCH_WEIGHTS.experience +
      educationScore * JOB_MATCH_WEIGHTS.education +
      locationScore * JOB_MATCH_WEIGHTS.location +
      keywordResult.score * JOB_MATCH_WEIGHTS.keywords
  );

  const scoresForExplanation = {
    overall,
    skillsScore: skills.score,
    roleScore,
    experienceScore,
    educationScore,
    locationScore,
    keywordScore: keywordResult.score,
  };

  return {
    ...scoresForExplanation,
    overall: Math.round(overall),
    matchedSkills: skills.matched,
    missingRequiredSkills: skills.missingRequired,
    missingPreferredSkills: skills.missingPreferred,
    matchedKeywords: keywordResult.matched,
    missingKeywords: keywordResult.missing,
    explanation: buildExplanation(
      scoresForExplanation,
      skills.matched,
      skills.missingRequired,
      skills.missingPreferred
    ),
  };
}
