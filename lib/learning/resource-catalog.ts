import { canonicalizeSkill } from "@/lib/jobs/skill-aliases";

export type ResourceType = "course" | "documentation" | "tutorial" | "practice" | "project" | "certification";

export interface CuratedResource {
  url: string;
  type: ResourceType;
  note: string;
}

/**
 * Hand-curated, individually verified (fetched live, confirmed responding
 * this session — see docs/AI_AGENT.md) resource entry points. Gemini
 * NEVER supplies a URL for a roadmap step — it only writes the narrative
 * explanation around whatever this catalog deterministically returns.
 * This is the only source of resource_url on learning_roadmap_items, so a
 * broken/hallucinated course link is structurally impossible.
 *
 * Deliberately small — a skill with no verified entry here gets a
 * resource_note like "Search for a well-reviewed beginner {skill} course"
 * instead of a fabricated link (see generate-roadmap.ts).
 */
const RESOURCE_CATALOG: Record<string, CuratedResource> = {
  python: { url: "https://docs.python.org/3/tutorial/", type: "documentation", note: "The official Python tutorial." },
  sql: { url: "https://www.w3schools.com/sql/", type: "tutorial", note: "A widely-used, free SQL tutorial." },
  "power bi": {
    url: "https://learn.microsoft.com/en-us/training/powerplatform/power-bi",
    type: "course",
    note: "Microsoft's own official Power BI learning path.",
  },
  excel: { url: "https://support.microsoft.com/en-us/excel", type: "documentation", note: "Microsoft's official Excel support/training hub." },
  tableau: { url: "https://www.tableau.com/learn/training", type: "course", note: "Tableau's own official training hub." },
  statistics: {
    url: "https://www.khanacademy.org/math/statistics-probability",
    type: "course",
    note: "Khan Academy's free statistics & probability course.",
  },
  git: { url: "https://git-scm.com/doc", type: "documentation", note: "The official Git documentation." },
  javascript: {
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    type: "documentation",
    note: "MDN's official JavaScript documentation.",
  },
  "machine learning": { url: "https://www.kaggle.com/learn", type: "course", note: "Kaggle's free, hands-on ML micro-courses." },
  pandas: {
    url: "https://pandas.pydata.org/docs/getting_started/index.html",
    type: "documentation",
    note: "The official pandas getting-started guide.",
  },
  aws: { url: "https://aws.amazon.com/training/", type: "course", note: "AWS's own official training hub." },
  docker: { url: "https://docs.docker.com/get-started/", type: "tutorial", note: "Docker's official getting-started guide." },
  azure: { url: "https://learn.microsoft.com/en-us/training/azure/", type: "course", note: "Microsoft's official Azure learning path." },
  gcp: { url: "https://cloud.google.com/training", type: "course", note: "Google Cloud's own official training hub." },
  html: { url: "https://developer.mozilla.org/en-US/docs/Web/HTML", type: "documentation", note: "MDN's official HTML documentation." },
  css: { url: "https://developer.mozilla.org/en-US/docs/Web/CSS", type: "documentation", note: "MDN's official CSS documentation." },
};

/** Returns a verified resource for `skill`, or null when none exists in the curated catalog — never fabricates one. */
export function findCuratedResource(skill: string): CuratedResource | null {
  return RESOURCE_CATALOG[canonicalizeSkill(skill)] ?? null;
}
