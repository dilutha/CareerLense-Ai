import { z } from "zod";

/**
 * Structured reminder intent extracted from one chat message. Gemini
 * fills `normalizedDateText` by translating/normalizing whatever date
 * phrase the user used (English, Sinhala, or Singlish) into a plain
 * English phrase like "next Monday" or "Friday 10am" — it does NOT
 * output a timestamp itself. lib/notifications/parse-datetime.ts is what
 * actually turns that normalized phrase into a real Date (Part 12/16:
 * "Never let the LLM invent the actual scheduled timestamp").
 */
export const ReminderIntentSchema = z.object({
  wantsReminder: z.boolean(),
  reminderType: z.enum(["follow_up", "interview", "unclear"]).nullable(),
  /** Company or role name the user mentioned, if any — used to match against their tracked applications. Never invented. */
  applicationHint: z.string().nullable(),
  /** The date/time phrase, normalized to plain English (e.g. "next Monday", "Friday 10am", "tomorrow"). Null if no date was mentioned at all. */
  normalizedDateText: z.string().nullable(),
  /** A short clarifying question to ask the user when applicationHint or normalizedDateText is missing/ambiguous. */
  clarifyingQuestion: z.string().nullable(),
});
export type ReminderIntent = z.infer<typeof ReminderIntentSchema>;
