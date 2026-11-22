/**
 * Pure invoice arithmetic and status derivation. No Prisma, no I/O.
 * All money is integer paise; quantities are integer milli-units.
 */

export type InvoiceLifecycle = "DRAFT" | "ISSUED";

export type InvoiceStatus = "DRAFT" | "ISSUED_UNPAID" | "PARTIALLY_PAID" | "PAID";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function assertSafe(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

/**
 * Line total = quantity (milli-units) * unit price (paise) / 1000, rounded half up.
 * Computed as floor((2*q*u + 1000) / 2000) to stay in integer arithmetic.
 */
export function lineTotalPaise(quantityMilli: number, unitPricePaise: number): number {
  assertSafe(quantityMilli, "Quantity");
  assertSafe(unitPricePaise, "Unit price");
  const doubled = 2 * quantityMilli * unitPricePaise;
  assertSafe(doubled + 1000, "Line total");
  return Math.floor((doubled + 1000) / 2000);
}

export function invoiceTotalPaise(items: ReadonlyArray<{ lineTotalPaise: number }>): number {
  let total = 0;
  for (const item of items) {
    assertSafe(item.lineTotalPaise, "Line total");
    total += item.lineTotalPaise;
    assertSafe(total, "Invoice total");
  }
  return total;
}

export function paidTotalPaise(payments: ReadonlyArray<{ amountPaise: number }>): number {
  let total = 0;
  for (const payment of payments) {
    assertSafe(payment.amountPaise, "Payment amount");
    total += payment.amountPaise;
    assertSafe(total, "Paid total");
  }
  return total;
}

export function outstandingPaise(totalPaise: number, paidPaise: number): number {
  return Math.max(0, totalPaise - paidPaise);
}

/**
 * DRAFT while not issued; otherwise derived from paid vs total.
 */
export function deriveInvoiceStatus(
  lifecycle: string,
  totalPaise: number,
  paidPaise: number,
): InvoiceStatus {
  if (lifecycle !== "ISSUED") {
    return "DRAFT";
  }
  if (outstandingPaise(totalPaise, paidPaise) === 0) {
    return "PAID";
  }
  if (paidPaise > 0) {
    return "PARTIALLY_PAID";
  }
  return "ISSUED_UNPAID";
}

/**
 * Overdue = issued, money still outstanding, and due date strictly before today.
 * Dates are YYYY-MM-DD strings.
 */
export function isOverdue(
  dueDate: string,
  outstanding: number,
  lifecycle: string,
  today: string,
): boolean {
  return lifecycle === "ISSUED" && outstanding > 0 && dueDate < today;
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/**
 * Whole calendar days between dueDate and today, never negative.
 */
export function overdueDays(dueDate: string, today: string): number {
  return Math.max(0, Math.round(dayNumber(today) - dayNumber(dueDate)));
}

/**
 * Returns an error message when the amount cannot be applied, otherwise null.
 */
export function validatePaymentAmount(amountPaise: number, outstanding: number): string | null {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return "Payment amount must be greater than zero";
  }
  if (amountPaise > outstanding) {
    return "Payment amount cannot exceed the outstanding balance";
  }
  return null;
}
