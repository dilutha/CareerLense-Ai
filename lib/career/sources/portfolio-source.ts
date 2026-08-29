import "server-only";
import { getLatestPortfolioAnalysis } from "@/lib/portfolio/get-portfolio";

/**
 * Returns both the overall portfolio score AND its "projects" category
 * sub-score — the latter feeds career readiness's separate "Projects"
 * component (reused rather than duplicated, see docs/DATABASE.md).
 */
export async function getPortfolioReadinessScores(
  userId: string
): Promise<{ overall: number | null; projects: number | null }> {
  const analysis = await getLatestPortfolioAnalysis(userId);
  if (!analysis) return { overall: null, projects: null };

  return {
    overall: analysis.overall_score,
    projects: analysis.category_scores?.projects ?? null,
  };
}
