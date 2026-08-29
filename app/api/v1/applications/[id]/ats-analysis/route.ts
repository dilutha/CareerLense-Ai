import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getOrCreateApplicationCore, runApplicationAnalysisCore } from "@/lib/application/actions";
import { getApplicationBundle } from "@/lib/application/get-application";
import { getDefaultResume } from "@/lib/resume/get-resumes";

/** `id` is a JOB id — see /applications/[id]/analyze/route.ts's header comment. */
const requestSchema = z.object({ resumeId: z.string().min(1).optional() });

/**
 * Reshapes the SAME deterministic comparison
 * (lib/application/compare.ts, via runApplicationAnalysisCore) that
 * /analyze already computes — not a second analysis engine, just
 * different response terminology matching Part 12's exact naming
 * requirement: "CareerLense ATS Alignment Score", never a claim of
 * representing a specific commercial ATS product's actual behavior.
 */
export const POST = apiHandler(
  "POST /applications/[id]/ats-analysis",
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "A valid Supabase access token is required.");

    let body: unknown = {};
    try {
      body = (await request.json().catch(() => ({}))) ?? {};
    } catch {
      // no body is fine
    }
    const parsed = requestSchema.safeParse(body);
    const resumeId = parsed.success ? parsed.data.resumeId : undefined;

    const { id: jobId } = await ctx.params;
    const effectiveResumeId = resumeId ?? (await getDefaultResume(auth.userId))?.resume.id;
    if (!effectiveResumeId) {
      return apiError("BAD_REQUEST", "No resumeId given and no default resume on file — upload a CV first.");
    }

    const created = await getOrCreateApplicationCore(auth.userId, auth.supabase, jobId, effectiveResumeId);
    if (!created.success || !created.documentId) {
      return apiError("BAD_REQUEST", created.error ?? "Couldn't start this application.");
    }

    const result = await runApplicationAnalysisCore(auth.userId, auth.supabase, created.documentId);
    if (!result.success) return apiError("BAD_REQUEST", result.error ?? "Couldn't run ATS analysis.");

    const bundle = await getApplicationBundle(auth.userId, jobId);
    const analysis = bundle.analysis;
    if (!analysis) return apiError("INTERNAL_ERROR", "Analysis didn't save correctly.");

    const missingKeywords = analysis.keyword_comparison.filter((k) => k.status === "missing").map((k) => k.keyword);
    const weakKeywords = analysis.keyword_comparison.filter((k) => k.status === "weak").map((k) => k.keyword);
    const presentKeywords = analysis.keyword_comparison.filter((k) => k.status === "present").map((k) => k.keyword);
    const relevantSkills = analysis.skill_comparison
      .filter((s) => s.category === "strong_match" || s.category === "match")
      .map((s) => s.skill);

    return apiSuccess({
      careerLensAtsAlignmentScore: analysis.overall_keyword_alignment,
      keywordMatch: presentKeywords,
      missingKeywords,
      weakKeywords,
      relevantSkills,
      skillComparison: analysis.skill_comparison,
      formattingRecommendations: [
        "Use standard section headings (Experience, Education, Skills) so automated parsers can identify them.",
        "Avoid tables/columns/text boxes for content that needs to be machine-readable.",
      ],
      disclaimer:
        "This is a CareerLens ATS Alignment Score — a deterministic keyword/skill comparison against this job's real requirements, not a guarantee of passing any specific commercial ATS product.",
    });
  }
);
