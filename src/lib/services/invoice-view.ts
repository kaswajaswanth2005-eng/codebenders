/**
 * Derived-view helpers for invoices. Pure: no Prisma, no I/O.
 * All arithmetic and status rules come from @/lib/financial/invoices; this module only composes them.
 */
import { todayKolkata } from "@/lib/financial/dates";
import {
  deriveInvoiceStatus,
  invoiceTotalPaise,
  isOverdue,
  outstandingPaise,
  overdueDays,
  paidTotalPaise,
  type InvoiceStatus,
} from "@/lib/financial/invoices";

/** Minimal shape needed to derive invoice fields. Extra properties are allowed. */
export type InvoiceForView = {
  lifecycle: string;
  dueDate: string;
  items: ReadonlyArray<{ lineTotalPaise: number }>;
  payments: ReadonlyArray<{ amountPaise: number }>;
};

export type DerivedInvoiceFields = {
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  status: InvoiceStatus;
  overdue: boolean;
  overdueDays: number;
};

/**
 * Computes totals, status and overdue information for one invoice.
 * `today` defaults to the current Asia/Kolkata calendar date (YYYY-MM-DD).
 */
export function deriveInvoiceFields(
  invoice: InvoiceForView,
  today: string = todayKolkata(),
): DerivedInvoiceFields {
  const totalPaise = invoiceTotalPaise(invoice.items);
  const paidPaise = paidTotalPaise(invoice.payments);
  const outstanding = outstandingPaise(totalPaise, paidPaise);
  return {
    totalPaise,
    paidPaise,
    outstandingPaise: outstanding,
    status: deriveInvoiceStatus(invoice.lifecycle, totalPaise, paidPaise),
    overdue: isOverdue(invoice.dueDate, outstanding, invoice.lifecycle, today),
    overdueDays: overdueDays(invoice.dueDate, today),
  };
}

export type ReceivablesSummary = {
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingPaise: number;
  overdueOutstandingPaise: number;
};

/**
 * Aggregates receivables across invoices. Only issued invoices with money outstanding count as open.
 */
export function summarizeReceivables(
  invoices: ReadonlyArray<InvoiceForView>,
  today: string = todayKolkata(),
): ReceivablesSummary {
  const summary: ReceivablesSummary = {
    openInvoiceCount: 0,
    overdueInvoiceCount: 0,
    outstandingPaise: 0,
    overdueOutstandingPaise: 0,
  };
  for (const invoice of invoices) {
    const fields = deriveInvoiceFields(invoice, today);
    if (invoice.lifecycle !== "ISSUED" || fields.outstandingPaise <= 0) {
      continue;
    }
    summary.openInvoiceCount += 1;
    summary.outstandingPaise += fields.outstandingPaise;
    if (fields.overdue) {
      summary.overdueInvoiceCount += 1;
      summary.overdueOutstandingPaise += fields.outstandingPaise;
    }
  }
  return summary;
}
