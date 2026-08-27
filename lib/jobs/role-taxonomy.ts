/**
 * A small, controlled role taxonomy (PROJECT_SPEC.md §68) — intentionally
 * not exhaustive. Groups related titles so "Data Analyst" and "BI
 * Analyst" are recognized as the same family, without treating "Data
 * Analyst" and "Senior Data Scientist" as interchangeable.
 */
export const ROLE_FAMILIES: Record<string, string[]> = {
  "data analytics": [
    "data analyst",
    "junior data analyst",
    "bi analyst",
    "business intelligence analyst",
    "reporting analyst",
    "data analyst intern",
  ],
  "software engineering": [
    "software engineer",
    "software developer",
    "junior software engineer",
    "graduate software engineer",
    "software engineer intern",
    "backend developer",
    "frontend developer",
    "full stack developer",
  ],
  cybersecurity: [
    "security analyst",
    "soc analyst",
    "cybersecurity intern",
    "cybersecurity analyst",
    "information security analyst",
  ],
  "machine learning": [
    "machine learning engineer",
    "ml engineer",
    "machine learning intern",
    "data scientist",
    "ai engineer",
  ],
  "business analysis": [
    "business analyst",
    "junior business analyst",
    "business systems analyst",
  ],
};

function findRoleFamily(title: string): string | null {
  const normalized = title.trim().toLowerCase();
  for (const [family, titles] of Object.entries(ROLE_FAMILIES)) {
    if (titles.some((t) => normalized.includes(t) || t.includes(normalized))) {
      return family;
    }
  }
  return null;
}

function tokenOverlapRatio(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

/** 0-100 role alignment score between a candidate's target role and a job title. */
export function scoreRoleAlignment(targetRole: string | null, jobTitle: string): number {
  if (!targetRole) return 60; // no stated preference — neutral, not penalized

  const targetFamily = findRoleFamily(targetRole);
  const jobFamily = findRoleFamily(jobTitle);

  if (targetFamily && jobFamily && targetFamily === jobFamily) return 100;

  const overlap = tokenOverlapRatio(targetRole, jobTitle);
  return Math.round(Math.max(20, overlap * 100));
}
