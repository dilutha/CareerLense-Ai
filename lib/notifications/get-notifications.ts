import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { NotificationRow } from "./types";

/**
 * Marks any due-but-unsent scheduled reminders (scheduled_for <= now,
 * sent_at still null) as sent, then returns every notification that's
 * actually been surfaced (sent_at not null), newest first. This is how a
 * scheduled reminder actually "arrives" in this deployment — there is no
 * background worker or cron pushing it in real time; it becomes visible
 * the next time the signed-in user loads a page that reads notifications,
 * at or after its scheduled_for time. See docs/AI_AGENT.md for the full
 * delivery-architecture explanation and what a real-time production
 * extension (e.g. a Vercel Cron hitting the same due-marking logic) would
 * still require.
 */
export async function getNotificationsForUser(userId: string): Promise<NotificationRow[]> {
  const supabase = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  await supabase
    .from("notifications")
    .update({ sent_at: nowIso })
    .eq("profile_id", userId)
    .is("sent_at", null)
    .lte("scheduled_for", nowIso);

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", userId)
    .not("sent_at", "is", null)
    .order("scheduled_for", { ascending: false })
    .limit(50);

  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId)
    .not("sent_at", "is", null)
    .is("read_at", null);
  return count ?? 0;
}

export interface UpcomingItem {
  id: string;
  title: string;
  scheduledFor: string;
  relatedApplicationId: string | null;
}

/** Not-yet-due scheduled reminders — the "Upcoming" widget's data source (Part 10). */
export async function getUpcomingItems(userId: string): Promise<UpcomingItem[]> {
  const supabase = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data } = await supabase
    .from("notifications")
    .select("id, title, scheduled_for, related_application_id")
    .eq("profile_id", userId)
    .is("sent_at", null)
    .gt("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(10);

  return ((data ?? []) as { id: string; title: string; scheduled_for: string; related_application_id: string | null }[]).map(
    (r) => ({ id: r.id, title: r.title, scheduledFor: r.scheduled_for, relatedApplicationId: r.related_application_id })
  );
}
