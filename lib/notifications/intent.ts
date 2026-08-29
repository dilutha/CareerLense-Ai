import "server-only";
import { z } from "zod";
import { getGeminiClient } from "@/lib/ai/client";
import { GEMINI_MODEL } from "@/lib/ai/config";
import { ReminderIntentSchema, type ReminderIntent } from "./intent-schema";

const REMINDER_KEYWORDS =
  /\b(remind|reminder|follow[\s-]?up|interview|mathaka|matak)\b|ලබන|ඉන්ටර්ව|මතක්/i;

/** Cheap keyword gate — avoids an extra Gemini call on every chat message. */
export function looksLikeReminderMessage(text: string): boolean {
  return REMINDER_KEYWORDS.test(text);
}

const INTENT_JSON_SCHEMA = z.toJSONSchema(ReminderIntentSchema) as Record<string, unknown>;
delete INTENT_JSON_SCHEMA.$schema;

const REMINDER_INTENT_SYSTEM_PROMPT = `You extract reminder/notification intent from one user message in a career-assistant chat, as JSON matching the provided schema.

Set wantsReminder to true only if the user is actually asking to be reminded about something related to a job application (a follow-up, an interview, a deadline) — e.g. "remind me to follow up with WSO2 next Monday", "interview eka Friday 10am", "mata meka next week remind karanna". Set it to false for anything else (general chat, a question about an existing reminder, small talk).

reminderType: "follow_up" for checking back on an application, "interview" for a scheduled interview, "unclear" if the user wants a reminder but it's not obvious which kind.

applicationHint: the company name or job title/role the user mentioned, verbatim or close to it, so it can be matched against their own tracked applications. Never invent a company the user didn't mention — null if none was given.

normalizedDateText: translate/normalize whatever date or time phrase the user used — in English, Sinhala, or Singlish — into a short plain-English phrase like "next Monday", "tomorrow", "Friday 10am", "in 3 days", or a YYYY-MM-DD date if a specific one was clearly stated. This is a translation/normalization task only — you are NOT choosing or computing the actual scheduled time, just restating what the user said in plain English so deterministic code can parse it. Null if no date/time was mentioned at all.

clarifyingQuestion: if wantsReminder is true but applicationHint or normalizedDateText is missing or too vague to act on, write ONE short, friendly clarifying question (matching CareerLens's informal Sinhala/Singlish/English personality) asking for exactly what's missing — e.g. "Hari machan 👍 Which company was that for?" or "What day/time works?". Null when nothing needs clarifying.`;

/**
 * Extracts structured reminder intent from the user's latest message.
 * Only called when looksLikeReminderMessage() already passed. Never
 * throws to the caller — a failed extraction just means no reminder gets
 * created this turn, the conversational reply still proceeds normally.
 */
export async function extractReminderIntent(userMessage: string): Promise<ReminderIntent | null> {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `User message: "${userMessage}"`,
      config: {
        systemInstruction: REMINDER_INTENT_SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: INTENT_JSON_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = ReminderIntentSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error(
      "[notifications] Reminder intent extraction failed:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
