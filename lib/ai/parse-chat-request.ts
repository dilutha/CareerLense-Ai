import "server-only";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH } from "./config";
import type { AgentMessage, ChatRole } from "./types";

const VALID_ROLES: ChatRole[] = ["user", "assistant", "system"];

/**
 * Validates and normalizes /api/chat's request body into a clean message
 * history. Extracted from app/api/chat/route.ts so this pure logic is
 * unit-testable in isolation — the route file transitively imports
 * "use server" action files, which crashes Vitest at import time (see
 * app/api/v1/auth-boundary.test.ts's header comment for the full
 * explanation), so nothing in route.ts itself can be tested directly.
 */
export function parseMessages(body: unknown): AgentMessage[] | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("messages" in body) ||
    !Array.isArray((body as { messages: unknown }).messages)
  ) {
    return null;
  }

  const rawMessages = (body as { messages: unknown[] }).messages;

  // Generous upper bound — the agent itself only uses the last
  // MAX_HISTORY_MESSAGES, this just guards against absurd payloads.
  if (rawMessages.length === 0 || rawMessages.length > MAX_HISTORY_MESSAGES * 4) {
    return null;
  }

  const messages: AgentMessage[] = [];
  for (const raw of rawMessages) {
    if (typeof raw !== "object" || raw === null) return null;

    const { id, role, content } = raw as Record<string, unknown>;
    if (typeof role !== "string" || !VALID_ROLES.includes(role as ChatRole)) {
      return null;
    }
    if (typeof content !== "string") return null;

    const trimmed = content.trim();
    if (trimmed.length > MAX_MESSAGE_LENGTH) return null;
    // Real bug found live: a job-results turn is persisted/sent as an
    // assistant message with content:"" (the actual cards render from
    // jobResults, not text — see ChatWindow.tsx's "jobs" event handler and
    // lib/chat/persist.ts). Rejecting the WHOLE request just because one
    // earlier message in history happens to be a job-card placeholder
    // broke every single message sent after any job search, not just URL
    // pastes. These carry no text for Gemini anyway, so they're dropped
    // here rather than aborting the request.
    if (trimmed.length === 0) continue;

    messages.push({
      id: typeof id === "string" && id.length > 0 ? id : crypto.randomUUID(),
      role: role as ChatRole,
      content: trimmed,
    });
  }

  if (messages.length === 0) return null;

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") return null;

  return messages;
}

/** null = "start a new conversation"; a string is only trusted after getOrCreateConversation verifies ownership. */
export function parseConversationId(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("conversationId" in body)) return null;
  const value = (body as { conversationId: unknown }).conversationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}
