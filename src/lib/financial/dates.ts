export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks that s is YYYY-MM-DD and a real calendar date (rejects 2026-02-30).
 */
export function isValidISODate(s: string): boolean {
  if (!ISO_DATE_PATTERN.test(s)) {
    return false;
  }
  const [year, month, day] = s.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const kolkataFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the calendar date (YYYY-MM-DD) of the given instant in Asia/Kolkata.
 */
export function todayKolkata(now: Date = new Date()): string {
  const parts = kolkataFormatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
