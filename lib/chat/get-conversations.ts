import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ConversationRow, MessageRow } from "./types";

export async function getConversationsForUser(userId: string): Promise<ConversationRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("profile_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(100);
  return (data ?? []) as ConversationRow[];
}

export interface ConversationWithMessages {
  conversation: ConversationRow;
  messages: MessageRow[];
}

/** Returns null if the conversation doesn't exist OR doesn't belong to this user — the caller treats both the same (never leaks whether a foreign conversation ID exists). */
export async function getConversationWithMessages(
  userId: string,
  conversationId: string
): Promise<ConversationWithMessages | null> {
  const supabase = await createServerSupabaseClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!conversation) return null;

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("profile_id", userId)
    .order("created_at", { ascending: true });

  return {
    conversation: conversation as ConversationRow,
    messages: (messages ?? []) as MessageRow[],
  };
}
