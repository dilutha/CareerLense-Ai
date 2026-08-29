/**
 * CareerLens is Sri Lanka-first (PROJECT_SPEC's own framing) and Sri
 * Lanka has a single fixed UTC+5:30 offset with no daylight saving —
 * unlike most timezones, this can be hardcoded safely without a timezone
 * library or the Intl timezone APIs. Every timestamp is still stored as a
 * real UTC timestamptz (existing project convention); this module only
 * handles converting to/from Colombo wall-clock time for date arithmetic
 * ("next Monday", "9am") and display.
 */
export const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface ColomboParts {
  year: number;
  month: number; // 0-indexed, matches Date's convention
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

export function toColomboParts(utcDate: Date): ColomboParts {
  const shifted = new Date(utcDate.getTime() + COLOMBO_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** Builds a real UTC Date from Colombo wall-clock components. */
export function fromColomboParts(year: number, month: number, day: number, hour: number, minute: number): Date {
  const asUtc = Date.UTC(year, month, day, hour, minute, 0, 0);
  return new Date(asUtc - COLOMBO_OFFSET_MS);
}

/** Formats a UTC instant as a short Colombo-local date/time string for display (e.g. "Sep 5, 9:00 AM"). */
export function formatColomboDateTime(utcDate: Date): string {
  const p = toColomboParts(utcDate);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const ampm = p.hour < 12 ? "AM" : "PM";
  const minuteStr = p.minute.toString().padStart(2, "0");
  return `${months[p.month]} ${p.day}, ${hour12}:${minuteStr} ${ampm}`;
}
