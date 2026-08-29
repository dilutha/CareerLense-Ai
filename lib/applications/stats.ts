import { CURRENTLY_AT_OR_PAST_INTERVIEW, type ApplicationStatus } from "./schemas";
import type { ApplicationStatusHistoryRow, ApplicationRow } from "./types";

export interface ApplicationStats {
  total: number;
  active: number;
  interviews: number;
  finalRounds: number;
  offers: number;
  rejected: number;
  /** interviews reached / total applications actually submitted — null if nothing has been applied to yet (never a fabricated 0%). */
  interviewRate: number | null;
  /** offers / total applications actually submitted — null if nothing applied yet. */
  offerRate: number | null;
  /** offers+interviews+finalRounds / total applications — a broader "got some response" measure. */
  responseRate: number | null;
}

function isPastInterviewEver(status: ApplicationStatus, history: ApplicationStatusHistoryRow[]): boolean {
  if (CURRENTLY_AT_OR_PAST_INTERVIEW.includes(status)) return true;
  // A rejection can happen at any stage — only count it as "reached
  // interview" if the history genuinely shows an interview status was
  // set at some point before the rejection. Never assumed.
  return history.some((h) => h.new_status === "interview" || h.new_status === "final_round" || h.new_status === "offer");
}

/**
 * Deterministic application statistics — no Gemini involved anywhere in
 * this computation. Every rate is null (never 0% or NaN) when the
 * denominator is genuinely zero, per PROJECT_SPEC's "never invent missing
 * metrics" / "handle division by zero" rules.
 */
export function computeApplicationStats(
  applications: ApplicationRow[],
  historyByApplication: Map<string, ApplicationStatusHistoryRow[]>
): ApplicationStats {
  const total = applications.length;
  const active = applications.filter((a) => !["offer", "rejected", "withdrawn", "closed"].includes(a.status)).length;
  const interviews = applications.filter((a) =>
    isPastInterviewEver(a.status, historyByApplication.get(a.id) ?? [])
  ).length;
  const finalRounds = applications.filter((a) => a.status === "final_round" || a.status === "offer").length;
  const offers = applications.filter((a) => a.status === "offer").length;
  const rejected = applications.filter((a) => a.status === "rejected").length;

  // "Submitted" = anything that reached at least "applied" — saved/interested/preparing
  // haven't actually been submitted yet, so they shouldn't dilute response-rate math.
  const submitted = applications.filter((a) => a.applied_at !== null || a.status === "applied").length;

  return {
    total,
    active,
    interviews,
    finalRounds,
    offers,
    rejected,
    interviewRate: submitted > 0 ? Math.round((interviews / submitted) * 1000) / 10 : null,
    offerRate: submitted > 0 ? Math.round((offers / submitted) * 1000) / 10 : null,
    responseRate: submitted > 0 ? Math.round(((interviews + offers) / submitted) * 1000) / 10 : null,
  };
}
