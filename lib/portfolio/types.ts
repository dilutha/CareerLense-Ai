import type { PortfolioFinding, PORTFOLIO_SCORE_CATEGORIES } from "./schemas";
import type { PortfolioExtractedContent } from "./schemas";

export interface PortfolioAnalysisRow {
  id: string;
  profile_id: string;
  url: string;
  content_hash: string;
  version_number: number;
  seo_findings: PortfolioExtractedContent;
  category_scores: Record<(typeof PORTFOLIO_SCORE_CATEGORIES)[number], number>;
  overall_score: number | null;
  findings: PortfolioFinding[];
  created_at: string;
}

export interface PortfolioGeneratedContentRow {
  id: string;
  profile_id: string;
  portfolio_analysis_id: string | null;
  section: string;
  content: string;
  created_at: string;
}
