import type { ChatMessage } from "@/lib/ai/types";
import type { MessageRow } from "./types";

/** Converts a persisted DB row into the shape ChatWindow's client state expects. */
export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at),
    status: "sent",
    jobResults: row.job_results ?? undefined,
  };
}
