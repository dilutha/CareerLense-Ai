import { describe, expect, it } from "vitest";
import { parseRelativeDate } from "./relative-date";

const NOW = new Date("2026-08-28T12:00:00.000Z");

describe("parseRelativeDate", () => {
  it("parses 'X days ago'", () => {
    const result = parseRelativeDate("3 days ago", NOW);
    expect(result).toBe(new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString());
  });

  it("parses 'X hours ago'", () => {
    const result = parseRelativeDate("5 hours ago", NOW);
    expect(result).toBe(new Date(NOW.getTime() - 5 * 60 * 60 * 1000).toISOString());
  });

  it("parses 'X weeks ago' and 'X months ago'", () => {
    expect(parseRelativeDate("2 weeks ago", NOW)).not.toBeNull();
    expect(parseRelativeDate("1 month ago", NOW)).not.toBeNull();
  });

  it("parses 'Just posted' and 'today' as now", () => {
    expect(parseRelativeDate("Just posted", NOW)).toBe(NOW.toISOString());
    expect(parseRelativeDate("Today", NOW)).toBe(NOW.toISOString());
  });

  it("parses 'yesterday'", () => {
    expect(parseRelativeDate("yesterday", NOW)).toBe(
      new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("is case-insensitive and tolerates a '30+ days ago' style prefix", () => {
    expect(parseRelativeDate("30+ days ago", NOW)).not.toBeNull();
  });

  it("returns null (never guesses) for an unrecognized format — never invents a posted date", () => {
    expect(parseRelativeDate("sometime last quarter", NOW)).toBeNull();
    expect(parseRelativeDate("", NOW)).toBeNull();
    expect(parseRelativeDate("2026-08-01", NOW)).toBeNull();
  });
});
