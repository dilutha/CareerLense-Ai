import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CareerAgentStateSchema, emptyAgentState, type CareerAgentState } from "./schema";

/**
 * Reads a conversation's agent_state, Zod-validating the stored JSONB
 * rather than trusting it as pre-validated (the database layer doesn't
 * enforce the schema — see migration 011's column comment). Falls back to
 * an empty state on any validation failure rather than throwing, since a
 * corrupted/legacy state blob shouldn't break the conversation.
 */
export async function getAgentState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  conversationId: string
): Promise<CareerAgentState> {
  const { data } = await supabase
    .from("conversations")
    .select("agent_state")
    .eq("id", conversationId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!data) return emptyAgentState();

  const parsed = CareerAgentStateSchema.safeParse((data as { agent_state: unknown }).agent_state);
  return parsed.success ? parsed.data : emptyAgentState();
}

export async function saveAgentState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  conversationId: string,
  state: CareerAgentState
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ agent_state: state })
    .eq("id", conversationId)
    .eq("profile_id", userId);

  if (error) {
    console.error("[agent-state] Saving state failed:", error.message);
  }
}
