export type PersistedMessageRole = "user" | "assistant" | "system";

export interface ConversationRow {
  id: string;
  profile_id: string;
  title: string;
  title_is_custom: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  profile_id: string;
  role: PersistedMessageRole;
  content: string;
  job_results: unknown[] | null;
  created_at: string;
}
