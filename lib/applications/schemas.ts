export const APPLICATION_STATUSES = [
  "saved",
  "interested",
  "preparing",
  "applied",
  "screening",
  "interview",
  "final_round",
  "offer",
  "rejected",
  "withdrawn",
  "closed",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  interested: "Interested",
  preparing: "Preparing",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  final_round: "Final Round",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

/** Statuses that count as "active" (still in progress) for dashboard summary stats. */
export const ACTIVE_STATUSES: ApplicationStatus[] = [
  "interested",
  "preparing",
  "applied",
  "screening",
  "interview",
  "final_round",
];

/**
 * Statuses that, taken alone (current status only, not history), confirm
 * an interview was reached. Deliberately excludes "rejected" — a
 * rejection can happen at ANY stage, and the current status alone can't
 * tell us whether it followed an interview. lib/applications/stats.ts
 * instead checks status HISTORY for a genuinely accurate interview count.
 */
export const CURRENTLY_AT_OR_PAST_INTERVIEW: ApplicationStatus[] = ["interview", "final_round", "offer"];

export function isValidApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}
