import { describe, expect, it } from "vitest";
import { shouldExtractStateUpdate } from "./extract-update";
import { emptyAgentState } from "./schema";

describe("shouldExtractStateUpdate", () => {
  const fresh = emptyAgentState();

  // Real bug, confirmed live: the original regex required a literal
  // trailing word boundary right after "internship", which never matches
  // "internships" (plural) or a bare "Intern" — 5 of the 9 phrases in the
  // product's own acceptance test failed this gate on a fresh
  // conversation, so the chat never even attempted a search for them.
  it.each([
    "Find me an internship",
    "give me job suggestions",
    "Find me jobs matching my CV",
    "Software Engineer Intern",
    "Find Software Engineer internships in Colombo",
    "Find Python internships",
    "Find ML internships",
    "Find full stack internships",
    "mata hoda reputed company ekaka intern ekak oni",
    "Tell me about vacancies",
    "opportunities available",
  ])("returns true for %s (fresh conversation)", (message) => {
    expect(shouldExtractStateUpdate(message, fresh)).toBe(true);
  });

  it.each(["I like pizza", "What is the weather today", "Thanks!"])(
    "returns false for unrelated small talk: %s",
    (message) => {
      expect(shouldExtractStateUpdate(message, fresh)).toBe(false);
    }
  );

  it("returns true for any message once intent is already job_search, even with no keyword", () => {
    const midSearch = { ...fresh, intent: "job_search" as const };
    expect(shouldExtractStateUpdate("international company ekak nam hodai", midSearch)).toBe(true);
  });
});
