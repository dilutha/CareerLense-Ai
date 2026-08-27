import "server-only";
import type { Content } from "@google/genai";
import { getGeminiClient } from "./client";
import { GENERATION_TEMPERATURE, GEMINI_MODEL, MAX_HISTORY_MESSAGES } from "./config";
import { detectCareerIntent } from "./intent";
import { CAREERLENS_SYSTEM_PROMPT } from "./prompts";
import type { AgentMessage } from "./types";

function toGeminiContents(messages: AgentMessage[]): Content[] {
  return messages
    .filter((message) => message.role !== "system")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

/**
 * Streams CareerLens's reply to a conversation as plain text chunks.
 *
 * This is the only place in the codebase that talks to the Gemini SDK — the
 * API route and UI never see Gemini-specific types, so swapping models or
 * SDKs later only touches this file.
 */
export async function* streamCareerAgentReply(
  messages: AgentMessage[],
  options: {
    signal?: AbortSignal;
    careerContext?: string;
    resumeContext?: string;
    jobContext?: string;
  } = {}
): AsyncGenerator<string> {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    console.log(`[career-agent] intent=${detectCareerIntent(lastUserMessage.content)}`);
  }

  const contextBlocks = [options.careerContext, options.resumeContext, options.jobContext].filter(
    Boolean
  );
  const systemInstruction =
    contextBlocks.length > 0
      ? `${CAREERLENS_SYSTEM_PROMPT}\n\n---\n\n${contextBlocks.join("\n\n---\n\n")}`
      : CAREERLENS_SYSTEM_PROMPT;

  const ai = getGeminiClient();
  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: toGeminiContents(messages),
    config: {
      systemInstruction,
      temperature: GENERATION_TEMPERATURE,
      abortSignal: options.signal,
    },
  });

  for await (const chunk of stream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}
