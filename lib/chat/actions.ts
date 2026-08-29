"use server";

import { revalidatePath } from "next/cache";
import { getOptionalUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function renameConversation(conversationId: string, title: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const trimmed = title.trim();
  if (!trimmed) return { success: false, error: "Give it a name first." };
  if (trimmed.length > 120) return { success: false, error: "That title's a bit long." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("conversations")
    .update({ title: trimmed, title_is_custom: true })
    .eq("id", conversationId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't rename that chat." };

  revalidatePath("/chat");
  return { success: true };
}

export async function deleteConversation(conversationId: string): Promise<ActionResult> {
  const user = await getOptionalUser();
  if (!user) return { success: false, error: "Please log in again." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("profile_id", user.id);

  if (error) return { success: false, error: "Couldn't delete that chat." };

  revalidatePath("/chat");
  return { success: true };
}
