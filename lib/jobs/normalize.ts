import "server-only";
import crypto from "node:crypto";
import { NormalizedJobSchema, type NormalizedJob } from "./schemas";

/**
 * Deterministic identity for a job when the provider doesn't give us a
 * stable source_job_id — used both for in-batch deduplication and as the
 * database's fallback unique key (jobs.content_hash).
 */
export function computeContentHash(job: NormalizedJob): string {
  const key = [
    job.source,
    job.title.trim().toLowerCase(),
    (job.company ?? "").trim().toLowerCase(),
    (job.location ?? "").trim().toLowerCase(),
    job.applicationUrl.trim().toLowerCase(),
  ].join("|");
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Provider responses are untrusted input — validates (not just trusts)
 * that a provider actually produced a well-formed NormalizedJob. Returns
 * null (rather than throwing) for a malformed entry so one bad result
 * doesn't fail an entire search.
 */
export function validateNormalizedJob(raw: unknown): NormalizedJob | null {
  const result = NormalizedJobSchema.safeParse(raw);
  if (!result.success) {
    console.error("[jobs] Rejected malformed job from provider:", result.error.issues[0]?.message);
    return null;
  }
  return result.data;
}
