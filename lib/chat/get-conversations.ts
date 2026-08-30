import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ConversationRow, MessageRow } from "./types";

export interface ConversationsResult {
  conversations: ConversationRow[];
  /**
   * True only when the query itself failed (network/DB error) — distinct
   * from "the user genuinely has zero conversations" so the UI never shows
   * the same empty state for both (see docs/AI_AGENT.md's chat-persistence
   * section for why this distinction matters).
   */
  failed: boolean;
}

export async function getConversationsForUser(userId: string): Promise<ConversationsResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("profile_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("getConversationsForUser: query failed", error);
    return { conversations: [], failed: true };
  }

  return { conversations: (data ?? []) as ConversationRow[], failed: false };
}

export interface ConversationWithMessages {
  conversation: ConversationRow;
  messages: MessageRow[];
}

/**
 * Returns null if the conversation doesn't exist OR doesn't belong to this
 * user — the caller treats both the same (never leaks whether a foreign
 * conversation ID exists). Throws on a genuine query failure so the caller
 * doesn't mistake "the database errored" for "not found" (a 404 would be
 * the wrong response to a transient DB error on a conversation the user
 * actually owns).
 */
export async function getConversationWithMessages(
  userId: string,
  conversationId: string
): Promise<ConversationWithMessages | null> {
  const supabase = await createServerSupabaseClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (conversationError) {
    console.error("getConversationWithMessages: conversation query failed", conversationError);
    throw new Error("Couldn't load this conversation.");
  }

  if (!conversation) return null;

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("profile_id", userId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("getConversationWithMessages: messages query failed", messagesError);
    throw new Error("Couldn't load this conversation.");
  }

  return {
    conversation: conversation as ConversationRow,
    messages: (messages ?? []) as MessageRow[],
  };
}
