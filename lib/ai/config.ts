import "server-only";

/**
 * Central model configuration. Change the model here (or via the
 * GEMINI_MODEL env var) — never hard-code a model name anywhere else.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

/** Max characters allowed in a single incoming message. */
export const MAX_MESSAGE_LENGTH = 4000;

/** Max messages of conversation history kept when calling Gemini. */
export const MAX_HISTORY_MESSAGES = 20;

export const GENERATION_TEMPERATURE = 0.8;
