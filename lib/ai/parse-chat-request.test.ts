import { describe, expect, it } from "vitest";
import { parseConversationId, parseMessages } from "./parse-chat-request";

describe("parseMessages", () => {
  it("accepts a simple valid history ending with a user message", () => {
    const result = parseMessages({
      messages: [
        { id: "1", role: "user", content: "hi" },
        { id: "2", role: "assistant", content: "hello!" },
        { id: "3", role: "user", content: "find me an internship" },
      ],
    });
    expect(result).toHaveLength(3);
    expect(result?.[2].content).toBe("find me an internship");
  });

  // The exact bug reported live: a job-results turn is sent as an
  // assistant message with content:"" (the real cards render from
  // jobResults, not text). The old implementation rejected the ENTIRE
  // request the moment any history message had empty content — breaking
  // every message sent after any job search, not just URL pastes.
  it("drops empty-content messages (job-card placeholders) instead of rejecting the whole request", () => {
    const result = parseMessages({
      messages: [
        { id: "1", role: "user", content: "find me an internship" },
        { id: "2", role: "assistant", content: "" }, // job-card placeholder
        { id: "3", role: "user", content: "https://xpress.jobs/jobs/view/309548/data-analyst" },
      ],
    });
    expect(result).not.toBeNull();
    expect(result?.map((m) => m.content)).toEqual([
      "find me an internship",
      "https://xpress.jobs/jobs/view/309548/data-analyst",
    ]);
  });

  it("drops multiple empty-content messages scattered through history", () => {
    const result = parseMessages({
      messages: [
        { id: "1", role: "user", content: "hi" },
        { id: "2", role: "assistant", content: "" },
        { id: "3", role: "user", content: "more jobs" },
        { id: "4", role: "assistant", content: "" },
        { id: "5", role: "user", content: "only Colombo" },
      ],
    });
    expect(result?.map((m) => m.content)).toEqual(["hi", "more jobs", "only Colombo"]);
  });

  it("returns null if EVERY message is empty-content", () => {
    const result = parseMessages({
      messages: [
        { id: "1", role: "assistant", content: "" },
        { id: "2", role: "assistant", content: "  " },
      ],
    });
    expect(result).toBeNull();
  });

  it("returns null if the last non-empty message is not from the user", () => {
    const result = parseMessages({
      messages: [
        { id: "1", role: "user", content: "hi" },
        { id: "2", role: "assistant", content: "hello" },
        { id: "3", role: "assistant", content: "" },
      ],
    });
    expect(result).toBeNull();
  });

  it("returns null for a non-array messages field", () => {
    expect(parseMessages({ messages: "not an array" })).toBeNull();
  });

  it("returns null for an empty messages array", () => {
    expect(parseMessages({ messages: [] })).toBeNull();
  });

  it("returns null for a message with a non-string content field", () => {
    const result = parseMessages({
      messages: [{ id: "1", role: "user", content: 123 }],
    });
    expect(result).toBeNull();
  });

  it("returns null for an invalid role", () => {
    const result = parseMessages({
      messages: [{ id: "1", role: "system-prompt-injection", content: "hi" }],
    });
    expect(result).toBeNull();
  });

  it("generates an id when one isn't supplied", () => {
    const result = parseMessages({ messages: [{ role: "user", content: "hi" }] });
    expect(result?.[0].id).toBeTruthy();
  });
});

describe("parseConversationId", () => {
  it("returns the id when present and non-empty", () => {
    expect(parseConversationId({ conversationId: "abc-123" })).toBe("abc-123");
  });

  it("returns null when absent", () => {
    expect(parseConversationId({})).toBeNull();
  });

  it("returns null for a non-string value", () => {
    expect(parseConversationId({ conversationId: 42 })).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseConversationId({ conversationId: "" })).toBeNull();
  });
});
