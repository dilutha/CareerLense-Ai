import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateConversationTitle } from "./generate-title";
import type { PersistedMessageRole } from "./types";

/**
 * Called from app/api/chat/route.ts, not a Server Action invoked from the
 * client — persistence is a side effect of handling a chat turn, not a
 * separate user-triggered mutation. A conversation row is only ever
 * created here, lazily, the moment its first real message exists —
 * clicking "New Chat" in the UI (Part 19) never creates an empty,
 * abandoned conversation row on its own.
 */
export async function getOrCreateConversation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  conversationId: string | null,
  firstUserMessage: string
): Promise<string | null> {
  if (conversationId) {
    // Verify ownership rather than trusting the client-supplied id —
    // RLS would reject a cross-user write anyway, but failing explicitly
    // here gives a clear signal instead of a silent insert failure.
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("profile_id", userId)
      .maybeSingle();
    if (data) return conversationId;
    return null;
  }

  const { data: inserted, error } = await supabase
    .from("conversations")
    .insert({
      profile_id: userId,
      title: generateConversationTitle(firstUserMessage),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[chat] Creating conversation failed:", error?.message);
    return null;
  }
  return (inserted as { id: string }).id;
}

export async function saveMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  input: {
    conversationId: string;
    userId: string;
    role: PersistedMessageRole;
    content: string;
    jobResults?: unknown[] | null;
  }
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    profile_id: input.userId,
    role: input.role,
    content: input.content,
    job_results: input.jobResults ?? null,
  });
  if (error) {
    console.error("[chat] Saving message failed:", error.message);
    return;
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", input.conversationId)
    .eq("profile_id", input.userId);
}
