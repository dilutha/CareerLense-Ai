import { describe, expect, it } from "vitest";
import { fromColomboParts, toColomboParts } from "./colombo-time";

describe("Colombo time conversion", () => {
  it("round-trips: fromColomboParts then toColomboParts returns the same wall-clock values", () => {
    const date = fromColomboParts(2026, 8, 5, 9, 30); // Sept 5, 2026, 9:30 AM Colombo
    const parts = toColomboParts(date);
    expect(parts).toEqual({ year: 2026, month: 8, day: 5, hour: 9, minute: 30, weekday: 6 }); // Sept 5, 2026 is a Saturday
  });

  it("produces the correct real UTC offset (Colombo is UTC+5:30)", () => {
    const date = fromColomboParts(2026, 0, 1, 12, 0); // Jan 1, 2026, noon Colombo
    expect(date.toISOString()).toBe("2026-01-01T06:30:00.000Z");
  });

  it("handles month/day rollover correctly (e.g. day 32 rolls into the next month)", () => {
    const date = fromColomboParts(2026, 0, 32, 9, 0); // "January 32" → Feb 1
    const parts = toColomboParts(date);
    expect(parts.month).toBe(1); // February
    expect(parts.day).toBe(1);
  });
});
