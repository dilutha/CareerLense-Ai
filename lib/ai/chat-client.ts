import type { AgentMessage, ChatStreamEvent } from "./types";

const FALLBACK_ERROR_MESSAGE =
  "Ado 😅 Gemini eka response denna bari una.\n\nTry eka parak aye yamu.";

/**
 * UI-facing boundary for talking to the CareerLens AI service.
 *
 * Streams NDJSON events (one JSON object per line — see ChatStreamEvent)
 * from POST /api/chat and yields them as they arrive. Chat components
 * never call Gemini or the career agent directly — only through this
 * function, so the AI provider/model can change without touching any
 * component.
 */
export async function* streamChatReply(
  messages: AgentMessage[],
  options: { signal?: AbortSignal; conversationId?: string | null } = {}
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, conversationId: options.conversationId ?? null }),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    const message =
      data && typeof data.error === "string" ? data.error : FALLBACK_ERROR_MESSAGE;
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;

      try {
        yield JSON.parse(line) as ChatStreamEvent;
      } catch {
        // A malformed line shouldn't be possible (the server only ever
        // writes JSON.stringify'd events) — skip defensively rather than
        // crash the stream.
      }
    }
  }

  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer) as ChatStreamEvent;
    } catch {
      // Trailing partial data with no newline — ignore.
    }
  }
}
