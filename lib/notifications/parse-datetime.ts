import { fromColomboParts, toColomboParts } from "./colombo-time";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export type ParseResult =
  | { ok: true; date: Date }
  | { ok: false; reason: "unparseable" | "past" };

interface TimeOfDay {
  hour: number;
  minute: number;
}

const DEFAULT_TIME: TimeOfDay = { hour: 9, minute: 0 };

/**
 * Extracts a "H(:MM)? (am|pm)?" time phrase from `text`, if present.
 * Only called on text that's already had any date-pattern match (ISO
 * date, "in N days", a weekday) removed from it — otherwise a date
 * fragment's digits (e.g. the "12" in "2026-12-25", or the "3" in "in 3
 * days") would be misread as an hour. See parseReminderDateTime for why
 * ordering matters here.
 */
function extractTime(text: string): TimeOfDay | null {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();

  if (hour > 23 || minute > 59) return null;

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (!ampm && hour >= 1 && hour <= 7) {
    // Bare "5" or "5:30" with no am/pm — for a reminder context, assume
    // a normal working-hours PM reading (e.g. "Friday 5" almost always
    // means 5pm, not 5am) rather than guessing am.
    hour += 12;
  }

  return { hour, minute };
}

function removeMatch(text: string, match: RegExpMatchArray): string {
  const index = match.index ?? 0;
  return (text.slice(0, index) + text.slice(index + match[0].length)).trim();
}

/**
 * Deterministically parses a normalized, English-language reminder
 * date/time phrase ("tomorrow", "next Monday", "Friday 10am", "in 3
 * days", "2026-09-05") into a real UTC Date, anchored to Asia/Colombo
 * wall-clock time. Returns { ok: false } rather than guessing when the
 * phrase can't be confidently parsed, or when the result would be in the
 * past — the caller (lib/notifications/intent.ts, chat route) must ask
 * the user to clarify in either case, never silently pick a date.
 *
 * Gemini may translate/normalize a Sinhala or Singlish phrase into
 * English before this function ever sees it (e.g. "ලබන සඳුදා" →
 * "next Monday") — but this function, not Gemini, is what turns text
 * into the actual scheduled timestamp.
 *
 * Date patterns are matched against the ORIGINAL text first, each on its
 * own — a trailing time is only extracted from what's left AFTER that
 * date match is removed. Running the generic hour-extractor first would
 * misread date digits as a time (e.g. the "12" in "2026-12-25", or the
 * "3" in "in 3 days").
 */
export function parseReminderDateTime(rawText: string, now: Date = new Date()): ParseResult {
  const text = rawText.trim().toLowerCase();
  if (!text) return { ok: false, reason: "unparseable" };

  const nowColombo = toColomboParts(now);

  // ISO date: 2026-09-05
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const time = extractTime(removeMatch(text, isoMatch)) ?? DEFAULT_TIME;
    return finalize(fromColomboParts(year, month, day, time.hour, time.minute), now);
  }

  // "in N days"
  const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDaysMatch) {
    const n = parseInt(inDaysMatch[1], 10);
    const time = extractTime(removeMatch(text, inDaysMatch)) ?? DEFAULT_TIME;
    const date = fromColomboParts(nowColombo.year, nowColombo.month, nowColombo.day + n, time.hour, time.minute);
    return finalize(date, now);
  }

  // "today"
  const todayMatch = text.match(/\btoday\b/);
  if (todayMatch) {
    const time = extractTime(removeMatch(text, todayMatch)) ?? DEFAULT_TIME;
    const date = fromColomboParts(nowColombo.year, nowColombo.month, nowColombo.day, time.hour, time.minute);
    return finalize(date, now);
  }

  // "tomorrow"
  const tomorrowMatch = text.match(/\btomorrow\b/);
  if (tomorrowMatch) {
    const time = extractTime(removeMatch(text, tomorrowMatch)) ?? DEFAULT_TIME;
    const date = fromColomboParts(nowColombo.year, nowColombo.month, nowColombo.day + 1, time.hour, time.minute);
    return finalize(date, now);
  }

  // "next <weekday>" or bare "<weekday>"
  const weekdayMatch = text.match(new RegExp(`\\b(next\\s+)?(${WEEKDAYS.join("|")})\\b`));
  if (weekdayMatch) {
    const isExplicitlyNext = Boolean(weekdayMatch[1]);
    const targetDow = WEEKDAYS.indexOf(weekdayMatch[2]);
    let daysAhead = (targetDow - nowColombo.weekday + 7) % 7;
    // Bare "Friday" said on a Friday means today; "next Friday" said on a
    // Friday means the following week, not today.
    if (daysAhead === 0 && isExplicitlyNext) daysAhead = 7;
    const time = extractTime(removeMatch(text, weekdayMatch)) ?? DEFAULT_TIME;
    const date = fromColomboParts(nowColombo.year, nowColombo.month, nowColombo.day + daysAhead, time.hour, time.minute);
    return finalize(date, now);
  }

  // A bare time with no date word — today if that time hasn't passed yet, else tomorrow.
  const bareTime = extractTime(text);
  if (bareTime) {
    const todayAttempt = fromColomboParts(nowColombo.year, nowColombo.month, nowColombo.day, bareTime.hour, bareTime.minute);
    if (todayAttempt.getTime() > now.getTime()) return finalize(todayAttempt, now);
    const tomorrowAttempt = fromColomboParts(nowColombo.year, nowColombo.month, nowColombo.day + 1, bareTime.hour, bareTime.minute);
    return finalize(tomorrowAttempt, now);
  }

  return { ok: false, reason: "unparseable" };
}

function finalize(date: Date, now: Date): ParseResult {
  if (Number.isNaN(date.getTime())) return { ok: false, reason: "unparseable" };
  if (date.getTime() <= now.getTime()) return { ok: false, reason: "past" };
  return { ok: true, date };
}
