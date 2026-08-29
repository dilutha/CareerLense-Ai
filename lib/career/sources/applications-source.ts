import "server-only";
import { computeApplicationStats } from "@/lib/applications/stats";
import type { ApplicationRow, ApplicationStatusHistoryRow } from "@/lib/applications/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * "Applications" readiness — a simple, documented, deterministic formula:
 * a baseline of 50 (credit for actually being active in the job search)
 * plus half of the response rate as a bonus, capped at 100. Not a
 * scientifically validated metric — see docs/DATABASE.md's Phase 11
 * section. Returns null (excluded from readiness, not scored 0) when the
 * candidate hasn't submitted any applications yet.
 */
export async function getApplicationsReadinessScore(userId: string): Promise<number | null> {
  const supabase = await createServerSupabaseClient();

  const { data: applications } = await supabase.from("applications").select("*").eq("profile_id", userId);
  const rows = (applications ?? []) as ApplicationRow[];
  if (rows.length === 0) return null;

  const { data: history } = await supabase
    .from("application_status_history")
    .select("*")
    .eq("profile_id", userId);
  const historyRows = (history ?? []) as ApplicationStatusHistoryRow[];

  const historyByApplication = new Map<string, ApplicationStatusHistoryRow[]>();
  for (const row of historyRows) {
    const list = historyByApplication.get(row.application_id) ?? [];
    list.push(row);
    historyByApplication.set(row.application_id, list);
  }

  const stats = computeApplicationStats(rows, historyByApplication);
  if (stats.responseRate === null) return null; // nothing submitted yet

  return Math.round(Math.min(100, 50 + stats.responseRate / 2));
}
