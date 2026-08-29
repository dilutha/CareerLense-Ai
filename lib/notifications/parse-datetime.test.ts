import { describe, expect, it } from "vitest";
import { parseReminderDateTime } from "./parse-datetime";
import { toColomboParts } from "./colombo-time";

// Wednesday, 2026-09-02, 10:00 Colombo time — chosen so "next Monday"/"Friday"/"tomorrow" are all unambiguous.
const NOW = new Date(Date.UTC(2026, 8, 2, 4, 30)); // 10:00 Colombo

describe("parseReminderDateTime", () => {
  it("parses 'tomorrow' as the next calendar day at the default time", () => {
    const result = parseReminderDateTime("tomorrow", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.day).toBe(3);
      expect(p.hour).toBe(9);
    }
  });

  it("parses 'next Monday' as the upcoming Monday", () => {
    const result = parseReminderDateTime("next Monday", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.weekday).toBe(1); // Monday
      expect(p.day).toBe(7); // Sept 7, 2026 is the next Monday after Wed Sept 2
    }
  });

  it("parses 'Friday 10am' with both weekday and time", () => {
    const result = parseReminderDateTime("Friday 10am", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.weekday).toBe(5); // Friday
      expect(p.hour).toBe(10);
      expect(p.minute).toBe(0);
    }
  });

  it("parses 'in 3 days'", () => {
    const result = parseReminderDateTime("in 3 days", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.day).toBe(5);
    }
  });

  it("treats a bare weekday matching today as today, when the time is still ahead", () => {
    // NOW is Wednesday 10:00 Colombo — 6pm hasn't happened yet today.
    const result = parseReminderDateTime("wednesday 6pm", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.day).toBe(2);
    }
  });

  it("a bare weekday matching today with no explicit time is 'past' once the 9am default has already passed — never silently rolls to next week", () => {
    // NOW is Wednesday 10:00 Colombo — the 9am default for "today" has already passed.
    const result = parseReminderDateTime("wednesday", NOW);
    expect(result).toEqual({ ok: false, reason: "past" });
  });

  it("interprets a bare PM-range hour with no am/pm as PM (e.g. 'Friday 5')", () => {
    const result = parseReminderDateTime("Friday 5", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.hour).toBe(17);
    }
  });

  it("parses an ISO date", () => {
    const result = parseReminderDateTime("2026-12-25", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.year).toBe(2026);
      expect(p.month).toBe(11);
      expect(p.day).toBe(25);
    }
  });

  it("returns { ok: false, reason: 'unparseable' } for gibberish — never guesses", () => {
    const result = parseReminderDateTime("machan hariyata dannne nae kavadada", NOW);
    expect(result).toEqual({ ok: false, reason: "unparseable" });
  });

  it("returns { ok: false, reason: 'unparseable' } for an empty string", () => {
    expect(parseReminderDateTime("", NOW)).toEqual({ ok: false, reason: "unparseable" });
  });

  it("returns { ok: false, reason: 'past' } for a date already in the past — never schedules a past reminder", () => {
    const result = parseReminderDateTime("2020-01-01", NOW);
    expect(result).toEqual({ ok: false, reason: "past" });
  });

  it("rolls a bare time already passed today over to tomorrow", () => {
    // NOW is 10:00 Colombo — 9am has already passed today.
    const result = parseReminderDateTime("9am", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.day).toBe(3);
      expect(p.hour).toBe(9);
    }
  });

  it("keeps a bare time not yet passed today as today", () => {
    const result = parseReminderDateTime("6pm", NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const p = toColomboParts(result.date);
      expect(p.day).toBe(2);
      expect(p.hour).toBe(18);
    }
  });
});
