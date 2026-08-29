import { z } from "zod";

export const LINKEDIN_SCORE_CATEGORIES = ["headline", "about", "skills_experience", "positioning"] as const;

export const LINKEDIN_CATEGORY_WEIGHTS: Record<(typeof LINKEDIN_SCORE_CATEGORIES)[number], number> = {
  headline: 0.25,
  about: 0.3,
  skills_experience: 0.25,
  positioning: 0.2,
};

export const LinkedInFindingSchema = z.object({
  label: z.string(),
  category: z.enum(LINKEDIN_SCORE_CATEGORIES),
  severity: z.enum(["critical", "high", "medium", "low", "good"]),
  impact: z.number().min(-15).max(15),
  explanation: z.string(),
});
export type LinkedInFinding = z.infer<typeof LinkedInFindingSchema>;

export const SkillRecommendationSchema = z.object({
  skill: z.string(),
  action: z.enum(["keep", "add", "deprioritize"]),
  reason: z.string(),
});

export const GeminiLinkedInOutputSchema = z.object({
  findings: z.array(LinkedInFindingSchema).min(1),
  skillRecommendations: z.array(SkillRecommendationSchema).default([]),
  summary: z.string().nullable(),
});
export type GeminiLinkedInOutput = z.infer<typeof GeminiLinkedInOutputSchema>;

export const LINKEDIN_CONTENT_SECTIONS = ["headline_a", "headline_b", "headline_c", "about", "skills"] as const;
export type LinkedInContentSection = (typeof LINKEDIN_CONTENT_SECTIONS)[number];
