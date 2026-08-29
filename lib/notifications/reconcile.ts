import type { DesiredReminder } from "./compute-reminders";
import type { NotificationRow } from "./types";

export interface ExistingScheduledReminder {
  id: string;
  type: NotificationRow["type"];
  scheduledFor: Date;
}

export interface ReconcileResult {
  toInsert: DesiredReminder[];
  toDeleteIds: string[];
}

/**
 * Pure diff between what SHOULD exist (computeDesiredReminders' output)
 * and what's currently in the database, restricted to still-unsent rows
 * (a reminder already surfaced to the user is never silently deleted out
 * from under them, even if its source date later changes). Matched by
 * (type, scheduledFor) — since computeDesiredReminders is deterministic,
 * an unchanged source date always reproduces the exact same
 * scheduledFor, so it's correctly recognized as "already exists" and
 * left alone; a changed date produces a different scheduledFor, so the
 * stale row is deleted and the new one inserted.
 */
export function reconcileReminders(
  desired: DesiredReminder[],
  existingUnsent: ExistingScheduledReminder[]
): ReconcileResult {
  const existingKeys = new Set(existingUnsent.map((e) => `${e.type}|${e.scheduledFor.getTime()}`));
  const desiredKeys = new Set(desired.map((d) => `${d.type}|${d.scheduledFor.getTime()}`));

  const toInsert = desired.filter((d) => !existingKeys.has(`${d.type}|${d.scheduledFor.getTime()}`));
  const toDeleteIds = existingUnsent
    .filter((e) => !desiredKeys.has(`${e.type}|${e.scheduledFor.getTime()}`))
    .map((e) => e.id);

  return { toInsert, toDeleteIds };
}
