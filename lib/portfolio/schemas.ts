import { z } from "zod";

// ---------------------------------------------------------------------------
// Deterministic extraction — plain parsing, no Gemini. See extract.ts.
// ---------------------------------------------------------------------------

export const PortfolioExtractedContentSchema = z.object({
  title: z.string().nullable(),
  metaDescription: z.string().nullable(),
  h1Count: z.number(),
  headingStructure: z.array(z.string()), // e.g. ["h1", "h2", "h2", "h3"]
  canonicalPresent: z.boolean(),
  robotsMetaPresent: z.boolean(),
  ogPresent: z.boolean(),
  structuredDataPresent: z.boolean(),
  imageCount: z.number(),
  imagesWithAlt: z.number(),
  internalLinkCount: z.number(),
  visibleText: z.string(),
});
export type PortfolioExtractedContent = z.infer<typeof PortfolioExtractedContentSchema>;

// ---------------------------------------------------------------------------
// Evaluative findings — Gemini reads the extracted content and produces
// findings; the score is computed deterministically from these (same
// pattern as lib/resume/analyze-resume.ts), never trusted as a raw number.
// ---------------------------------------------------------------------------

export const PORTFOLIO_SCORE_CATEGORIES = [
  "career_positioning",
  "projects",
  "technical_evidence",
  "content_quality",
  "recruiter_readability",
  "seo",
] as const;

/** Must sum to 100 — see docs/PROJECT_SPEC.md's Phase 10 entry. */
export const PORTFOLIO_CATEGORY_WEIGHTS: Record<(typeof PORTFOLIO_SCORE_CATEGORIES)[number], number> = {
  career_positioning: 0.2,
  projects: 0.25,
  technical_evidence: 0.2,
  content_quality: 0.15,
  recruiter_readability: 0.1,
  seo: 0.1,
};

export const FINDING_SEVERITIES = ["critical", "high", "medium", "low", "good"] as const;

export const PortfolioFindingSchema = z.object({
  label: z.string(),
  category: z.enum(PORTFOLIO_SCORE_CATEGORIES),
  severity: z.enum(FINDING_SEVERITIES),
  /** Positive = strength, negative = weakness. Severity drives display; impact drives the score. */
  impact: z.number().min(-15).max(15),
  explanation: z.string(),
});
export type PortfolioFinding = z.infer<typeof PortfolioFindingSchema>;

export const PortfolioKeywordSuggestionSchema = z.object({
  keyword: z.string(),
  whereToUse: z.array(z.string()).default([]), // e.g. ["hero", "about", "skills"]
});

export const GeminiPortfolioOutputSchema = z.object({
  findings: z.array(PortfolioFindingSchema).min(1),
  keywordSuggestions: z.array(PortfolioKeywordSuggestionSchema).default([]),
  summary: z.string().nullable(),
});
export type GeminiPortfolioOutput = z.infer<typeof GeminiPortfolioOutputSchema>;

// ---------------------------------------------------------------------------
// Generated content — hero/about/project/skills/summary/cta drafts,
// grounded in VerifiedFacts (lib/application/verified-facts.ts, reused
// directly). Plain text output, no JSON schema needed.
// ---------------------------------------------------------------------------

export const PORTFOLIO_CONTENT_SECTIONS = ["hero", "about", "project", "skills", "summary", "cta"] as const;
export type PortfolioContentSection = (typeof PORTFOLIO_CONTENT_SECTIONS)[number];
