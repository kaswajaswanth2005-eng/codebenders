/**
 * Pure bill scheduling and status rules. No Prisma, no clock reads: callers pass "today".
 * All dates are YYYY-MM-DD strings. Arithmetic uses Date.UTC only.
 */

export type BillSchedule = {
  firstDueDate: string;
  recurrence: string;
  archivedOn: string | null;
};

export type OccurrenceStatus = "PAID" | "OVERDUE" | "UPCOMING";

type YMD = { year: number; month: number; day: number };

function parseISO(iso: string): YMD {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function formatISO(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the date n months after isoDate, keeping the original day-of-month and clamping to the
 * last day of the target month (Jan 31 + 1 month = Feb 28/29). Always computed from the anchor
 * date passed in, never from a previous occurrence, so there is no drift.
 */
export function addMonthsAnchored(isoDate: string, n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError("Month offset must be a non-negative integer");
  }
  const { year, month, day } = parseISO(isoDate);
  const monthIndex = month - 1 + n;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return formatISO(new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))));
}

/**
 * Adds a number of calendar days to a YYYY-MM-DD date (negative values allowed).
 */
export function addDaysISO(isoDate: string, days: number): string {
  const { year, month, day } = parseISO(isoDate);
  return formatISO(new Date(Date.UTC(year, month - 1, day + days)));
}

/**
 * Whole days from a to b (b - a). Both must be YYYY-MM-DD.
 */
export function daysBetween(a: string, b: string): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  const msA = Date.UTC(pa.year, pa.month - 1, pa.day);
  const msB = Date.UTC(pb.year, pb.month - 1, pb.day);
  return Math.round((msB - msA) / 86_400_000);
}

/**
 * Due dates of a bill that fall within [fromDate, toDate] inclusive, ascending.
 * NONE yields firstDueDate only. MONTHLY yields anchored dates from firstDueDate onward.
 * Occurrences on or after archivedOn are excluded. Nothing before firstDueDate is generated.
 */
export function occurrencesInRange(bill: BillSchedule, fromDate: string, toDate: string): string[] {
  if (fromDate > toDate) {
    return [];
  }

  if (bill.recurrence !== "MONTHLY") {
    const due = bill.firstDueDate;
    if (due < fromDate || due > toDate) return [];
    if (bill.archivedOn !== null && due >= bill.archivedOn) return [];
    return [due];
  }

  const first = parseISO(bill.firstDueDate);
  const from = parseISO(fromDate);
  // Start one month before the range's month: that occurrence is guaranteed to be before fromDate,
  // so skipping earlier offsets never drops a date inside the range.
  const skip = Math.max(0, (from.year - first.year) * 12 + (from.month - first.month) - 1);

  const out: string[] = [];
  for (let n = skip; ; n++) {
    const due = addMonthsAnchored(bill.firstDueDate, n);
    if (due > toDate) break;
    if (bill.archivedOn !== null && due >= bill.archivedOn) break;
    if (due >= fromDate) out.push(due);
  }
  return out;
}

/**
 * PAID if a payment date is recorded; OVERDUE if unpaid and due before today; otherwise UPCOMING.
 */
export function classifyOccurrence(
  dueDate: string,
  paidDate: string | null,
  today: string,
): OccurrenceStatus {
  if (paidDate !== null) return "PAID";
  if (dueDate < today) return "OVERDUE";
  return "UPCOMING";
}

/**
 * True when dueDate falls between today and today + days (inclusive). Says nothing about payment
 * status; callers decide whether paid occurrences should be flagged.
 */
export function dueSoon(dueDate: string, today: string, days = 7): boolean {
  return dueDate >= today && dueDate <= addDaysISO(today, days);
}
