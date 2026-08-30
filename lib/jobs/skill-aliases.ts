/**
 * Small, controlled skill-alias dictionary so "Postgres"/"PostgreSQL",
 * "React"/"React.js", "ML"/"Machine Learning" etc. are recognized as the
 * same skill, without letting free-form AI reasoning decide that
 * unrelated skills "kind of match" (see PROJECT_SPEC.md §21).
 */
const SKILL_CANONICAL_MAP: Record<string, string> = {
  postgres: "postgresql",
  psql: "postgresql",
  postgresql: "postgresql",
  js: "javascript",
  javascript: "javascript",
  ts: "typescript",
  typescript: "typescript",
  "react.js": "react",
  reactjs: "react",
  react: "react",
  "next.js": "nextjs",
  nextjs: "nextjs",
  "node.js": "nodejs",
  node: "nodejs",
  nodejs: "nodejs",
  ml: "machine learning",
  "machine learning": "machine learning",
  ai: "artificial intelligence",
  "artificial intelligence": "artificial intelligence",
  "power bi": "power bi",
  powerbi: "power bi",
  py: "python",
  python: "python",
  sql: "sql",
  "sql server": "sql",
  mysql: "mysql",
  excel: "excel",
  "ms excel": "excel",
  "microsoft excel": "excel",
  tableau: "tableau",
  git: "git",
  github: "git",
  html: "html",
  css: "css",
  "html/css": "html",
  aws: "aws",
  "amazon web services": "aws",
  gcp: "gcp",
  "google cloud": "gcp",
  "google cloud platform": "gcp",
  azure: "azure",
  docker: "docker",
  kubernetes: "kubernetes",
  k8s: "kubernetes",
  java: "java",
  spring: "spring framework",
  "spring framework": "spring framework",
  "c++": "c++",
  cpp: "c++",
  "c#": "c#",
  csharp: "c#",
  pandas: "pandas",
  numpy: "numpy",
  communication: "communication",
  "communication skills": "communication",
  teamwork: "teamwork",
  "problem solving": "problem solving",
  "problem-solving": "problem solving",
};

export function canonicalizeSkill(name: string): string {
  const normalized = name.trim().toLowerCase();
  return SKILL_CANONICAL_MAP[normalized] ?? normalized;
}

export function skillsEquivalent(a: string, b: string): boolean {
  return canonicalizeSkill(a) === canonicalizeSkill(b);
}

/** True if `needle` has an equivalent skill anywhere in `haystack`. */
export function hasEquivalentSkill(needle: string, haystack: string[]): boolean {
  const canonicalNeedle = canonicalizeSkill(needle);
  return haystack.some((h) => canonicalizeSkill(h) === canonicalNeedle);
}
