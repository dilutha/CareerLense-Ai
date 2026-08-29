export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageStatus = "sending" | "sent" | "error";

export type ToolStatusType =
  | "searching_jobs"
  | "analyzing_resume"
  | "analyzing_portfolio"
  | "matching_job"
  | "improving_resume"
  | "generating_cover_letter"
  | "preparing_interview";

export interface ChecklistCard {
  title: string;
  items: string[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  status?: MessageStatus;
  toolStatus?: ToolStatusType;
  jobPreview?: ChecklistCard;
  resumeAnalysis?: ChecklistCard;
  /** True while an assistant message is still receiving stream chunks. */
  streaming?: boolean;
  /** Set when this turn's /api/chat response included real job search results. */
  // Uses `unknown[]` here to avoid a lib/ai -> lib/jobs import; narrowed to
  // JobResultSummary[] at the render site (MessageList / JobResultsMessage).
  jobResults?: unknown[];
}

/** Overall activity state of the chat window (not per-message). */
export type ChatStatus = "idle" | "sending" | "streaming" | "complete" | "error";

// ---------------------------------------------------------------------------
// Wire-level types — client <-> /api/chat <-> Gemini. Deliberately minimal:
// UI-only fields (status, toolStatus, cards) never leave the browser, and
// Gemini never sees them.
// ---------------------------------------------------------------------------

export type ChatRole = "user" | "assistant" | "system";

export interface AgentMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
}

/**
 * NDJSON event protocol for /api/chat's response body — one JSON object
 * per line. Lets the stream carry structured job-search results alongside
 * the normal streamed text, without a bigger rewrite to SSE framing. See
 * lib/ai/chat-client.ts for the parser and lib/jobs/summary.ts for the
 * JobResultSummary shape (kept as `unknown` here for the same reason as
 * ChatMessage.jobResults above).
 */
export type ChatStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "status"; toolStatus: ToolStatusType }
  | { type: "text"; content: string }
  | { type: "jobs"; jobs: unknown[] }
  | { type: "error"; message: string };

/**
 * Lightweight, server-side-only classification of what the user is asking
 * for. Not shown to the user and not (yet) used to change what's sent to
 * Gemini — it exists to prepare the architecture for real intent-driven
 * tool routing in a later phase.
 */
export type CareerIntent =
  | "general_career"
  | "job_search"
  | "internship_search"
  | "resume_review"
  | "portfolio_review"
  | "job_match"
  | "cover_letter"
  | "interview_prep"
  | "career_planning"
  | "skill_gap"
  | "unknown";

// ---------------------------------------------------------------------------
// Mock-only types — retained for lib/ai/mock.ts (dev/testing fallback only).
// ---------------------------------------------------------------------------

/**
 * One unit of a mock reply: a tool call, a status update, a chunk of text.
 * Not used by the live Gemini path, which streams plain text.
 */
export type ReplyStep =
  | { kind: "tool_status"; toolStatus: ToolStatusType }
  | { kind: "text"; content: string }
  | { kind: "job_preview"; title: string; items: string[] }
  | { kind: "resume_analysis"; title: string; items: string[] };

export interface ChatReply {
  steps: ReplyStep[];
}
