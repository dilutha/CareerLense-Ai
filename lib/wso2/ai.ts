import "server-only";
import { callWso2 } from "./client";
import type { CareerAnalysisRequest, CareerAnalysisResult } from "@/lib/api/career-analysis";

interface Wso2SuccessEnvelope {
  success: true;
  [key: string]: unknown;
}

/**
 * Wraps POST /ai/career-analysis, the OpenAPI's "main WSO2 + Gemini
 * demonstration endpoint." No web UI currently calls this — CareerLens's
 * own career-analysis-shaped features (chat, /career pages) use their
 * own direct Gemini calls with richer context than this generic
 * endpoint's request shape supports. Implemented here so the operation
 * is genuinely available to WSO2 API consumers (matching the OpenAPI
 * contract), per this phase's explicit instruction not to invent a new
 * UI feature just to create a caller.
 */
export async function careerAnalysisViaWso2(
  userAccessToken: string,
  input: CareerAnalysisRequest
): Promise<CareerAnalysisResult> {
  const result = await callWso2<Wso2SuccessEnvelope & { analysis: CareerAnalysisResult }>("/ai/career-analysis", {
    method: "POST",
    userAccessToken,
    body: input,
    timeoutMs: 30_000,
  });
  return result.analysis;
}
