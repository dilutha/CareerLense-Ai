import "server-only";
import { getLatestGitHubAnalysis } from "@/lib/github/get-github";

export async function getGithubAnalysisScore(userId: string): Promise<number | null> {
  const analysis = await getLatestGitHubAnalysis(userId);
  return analysis?.overall_score ?? null;
}
