import "server-only";
import { findRelatedSkill } from "@/lib/application/related-skills";
import { canonicalizeSkill, hasEquivalentSkill } from "@/lib/jobs/skill-aliases";
import { findRoleFamily } from "@/lib/jobs/role-taxonomy";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface MarketSkillDemand {
  skill: string;
  /** count(jobs mentioning this skill) / relevantJobCount * 100 — never invented, only computed from stored job_skills rows. */
  demandPercent: number;
  requiredCount: number;
  preferredCount: number;
  jobCount: number;
}

export interface MarketSkillReport {
  targetRole: string;
  relevantJobCount: number;
  demand: MarketSkillDemand[];
  /** True when relevantJobCount is too small to responsibly quote a percentage as representative. */
  smallSample: boolean;
}

const SMALL_SAMPLE_THRESHOLD = 5;

/**
 * Aggregates lib/jobs' own already-stored job_skills across jobs relevant
 * to a target role — entirely deterministic (plain SQL/TypeScript
 * counting), never asks Gemini to estimate a percentage. "Relevant" means
 * the job's title falls in the same role family as the target role
 * (lib/jobs/role-taxonomy.ts, the same curated taxonomy job matching
 * already uses) — a simple, explainable filter, not a fuzzy AI judgment.
 */
export async function computeMarketSkillDemand(targetRole: string): Promise<MarketSkillReport> {
  const supabase = await createServerSupabaseClient();
  const targetFamily = findRoleFamily(targetRole);

  // Pull a bounded, recent set of job titles+ids to filter by role family
  // in application code (role-taxonomy's matching isn't expressible as a
  // simple SQL WHERE without duplicating the taxonomy in SQL).
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false })
    .limit(500);

  const relevantJobIds = ((jobs ?? []) as { id: string; title: string }[])
    .filter((job) => {
      if (!targetFamily) return false;
      return findRoleFamily(job.title) === targetFamily;
    })
    .map((job) => job.id);

  if (relevantJobIds.length === 0) {
    return { targetRole, relevantJobCount: 0, demand: [], smallSample: true };
  }

  const { data: skillRows } = await supabase
    .from("job_skills")
    .select("job_id, skill_name, importance")
    .in("job_id", relevantJobIds);

  const rows = (skillRows ?? []) as { job_id: string; skill_name: string; importance: string }[];

  const bySkill = new Map<string, { jobIds: Set<string>; required: number; preferred: number }>();
  for (const row of rows) {
    const canonical = canonicalizeSkill(row.skill_name);
    const entry = bySkill.get(canonical) ?? { jobIds: new Set(), required: 0, preferred: 0 };
    entry.jobIds.add(row.job_id);
    if (row.importance === "required") entry.required += 1;
    else entry.preferred += 1;
    bySkill.set(canonical, entry);
  }

  const relevantJobCount = relevantJobIds.length;
  const demand: MarketSkillDemand[] = [...bySkill.entries()]
    .map(([skill, entry]) => ({
      skill,
      demandPercent: Math.round((entry.jobIds.size / relevantJobCount) * 1000) / 10,
      requiredCount: entry.required,
      preferredCount: entry.preferred,
      jobCount: entry.jobIds.size,
    }))
    .sort((a, b) => b.demandPercent - a.demandPercent);

  return {
    targetRole,
    relevantJobCount,
    demand,
    smallSample: relevantJobCount < SMALL_SAMPLE_THRESHOLD,
  };
}

export type SkillClassification = "strong" | "developing" | "missing" | "emerging";

export interface ClassifiedSkill {
  skill: string;
  classification: SkillClassification;
  demandPercent: number;
  relatedSkillFound: string | null;
}

const HIGH_DEMAND_THRESHOLD = 40;

/**
 * Classifies each market-demanded skill against the candidate's own
 * skills — deterministic, reusing the existing skill-alias and
 * related-skill utilities (lib/jobs/skill-aliases.ts,
 * lib/application/related-skills.ts) rather than a new AI judgment call.
 */
export function classifyMarketSkills(report: MarketSkillReport, candidateSkills: string[]): ClassifiedSkill[] {
  return report.demand.map((entry) => {
    if (hasEquivalentSkill(entry.skill, candidateSkills)) {
      return { skill: entry.skill, classification: "strong", demandPercent: entry.demandPercent, relatedSkillFound: null };
    }
    const related = findRelatedSkill(entry.skill, candidateSkills);
    if (related) {
      return { skill: entry.skill, classification: "developing", demandPercent: entry.demandPercent, relatedSkillFound: related };
    }
    return {
      skill: entry.skill,
      classification: entry.demandPercent >= HIGH_DEMAND_THRESHOLD ? "missing" : "emerging",
      demandPercent: entry.demandPercent,
      relatedSkillFound: null,
    };
  });
}
