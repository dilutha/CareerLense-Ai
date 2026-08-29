import "server-only";
import { getDefaultResume } from "@/lib/resume/get-resumes";

export async function getResumeReadinessScore(userId: string): Promise<number | null> {
  const resume = await getDefaultResume(userId);
  return resume?.analysis?.overall_score ?? null;
}
