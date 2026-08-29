import "server-only";
import { getLatestLinkedInAnalysis } from "@/lib/linkedin/get-linkedin";

export async function getLinkedInAnalysisScore(userId: string): Promise<number | null> {
  const analysis = await getLatestLinkedInAnalysis(userId);
  return analysis?.overall_score ?? null;
}
