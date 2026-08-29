"use server";

import { revalidatePath } from "next/cache";
import { getOptionalUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't mark that as read." };

  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .is("read_at", null);

  if (error) return { success: false, error: "Couldn't mark everything as read." };

  revalidatePath("/notifications");
  return { success: true };
}
