import { describe, expect, it } from "vitest";
import { generateConversationTitle } from "./generate-title";

describe("generateConversationTitle", () => {
  it("capitalizes the first letter of a short message", () => {
    expect(generateConversationTitle("find me a job")).toBe("Find me a job");
  });

  it("falls back to 'New chat' for an empty or whitespace-only message", () => {
    expect(generateConversationTitle("")).toBe("New chat");
    expect(generateConversationTitle("   ")).toBe("New chat");
  });

  it("collapses internal whitespace/newlines to single spaces", () => {
    expect(generateConversationTitle("find   me\n\na job")).toBe("Find me a job");
  });

  it("truncates a long message at a word boundary with an ellipsis", () => {
    const long = "machan mata data science internship ekak one Colombo wala hoyanna puluwanda kiyala danna one";
    const title = generateConversationTitle(long);
    expect(title.length).toBeLessThanOrEqual(49); // 48 + ellipsis char
    expect(title.endsWith("…")).toBe(true);
    expect(title.endsWith(" …")).toBe(false); // no dangling space before the ellipsis
  });

  it("never crashes on a message shorter than the truncation length", () => {
    expect(() => generateConversationTitle("hi")).not.toThrow();
    expect(generateConversationTitle("hi")).toBe("Hi");
  });
});
