/**
 * Date display helpers for the forecast screens. Pure string handling on YYYY-MM-DD values,
 * no Date parsing, so the output never shifts with the host time zone.
 * No "use client" here: this module is imported by both server and client components.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function splitISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

/** "2026-11-10" -> "10 Nov". Used for chart axis ticks. */
export function formatDayMonth(iso: string): string {
  const { month, day } = splitISO(iso);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "2026-11-10" -> "10 Nov 2026". Used for summaries, tables and tooltips. */
export function formatDisplayDate(iso: string): string {
  const { year, month, day } = splitISO(iso);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
