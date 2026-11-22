/**
 * Rule-based Action Center alerts. Pure: takes plain data, no Prisma, no I/O, no clock reads.
 * The caller passes "today" (YYYY-MM-DD, Asia/Kolkata).
 */
import { addDaysISO } from "@/lib/financial/bills";
import { formatINR } from "@/lib/financial/money";

export type AlertType =
  | "INVOICE_OVERDUE"
  | "INVOICE_DUE_SOON"
  | "BILL_DUE_SOON"
  | "CASH_SHORTFALL"
  | "MULTIPLE_OVERDUE"
  | "PAST_DUE_BILL";
export type AlertSeverity = "critical" | "warning";

export type Alert = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  headline: string;
  explanation: string;
  relatedRecordId: string | null;
  actionLabel: string;
  actionHref: string;
};

export type OverdueInvoiceInput = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  outstandingPaise: number;
  overdueDays: number;
};

export type UnpaidBillInput = {
  billId: string;
  title: string;
  dueDate: string;
  amountPaise: number;
};

export type DueSoonInvoiceInput = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  dueDate: string;
  outstandingPaise: number;
};

export type CashShortfallInput = {
  date: string;
  minimumCashPaise: number;
};

export type AlertInput = {
  today: string;
  overdueInvoices: OverdueInvoiceInput[];
  dueSoonInvoices?: DueSoonInvoiceInput[];
  unpaidBills: UnpaidBillInput[];
  pastDueBills?: UnpaidBillInput[];
  cashShortfall?: CashShortfallInput | null;
};

export const BILL_DUE_SOON_DAYS = 7;
export const INVOICE_DUE_SOON_DAYS = 3;
export const MULTIPLE_OVERDUE_THRESHOLD = 3;

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function buildAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];

  if (input.overdueInvoices.length >= MULTIPLE_OVERDUE_THRESHOLD) {
    const total = input.overdueInvoices.reduce((sum, inv) => sum + inv.outstandingPaise, 0);
    alerts.push({
      id: "multiple-overdue",
      type: "MULTIPLE_OVERDUE",
      severity: "critical",
      headline: `${plural(input.overdueInvoices.length, "invoice")} are overdue`,
      explanation: `${formatINR(total)} is past due across ${input.overdueInvoices.length} invoices.`,
      relatedRecordId: null,
      actionLabel: "View overdue invoices",
      actionHref: "/invoices?status=OVERDUE",
    });
  }

  for (const invoice of input.overdueInvoices) {
    alerts.push({
      id: `invoice-overdue-${invoice.id}`,
      type: "INVOICE_OVERDUE",
      severity: "critical",
      headline: `Invoice ${invoice.invoiceNumber} is overdue`,
      explanation: `${invoice.customerName} owes ${formatINR(invoice.outstandingPaise)}, ${plural(invoice.overdueDays, "day")} past the due date.`,
      relatedRecordId: invoice.id,
      actionLabel: "Prepare reminder",
      actionHref: `/invoices/${invoice.id}#payment-reminder`,
    });
  }

  const invoiceDueLimit = addDaysISO(input.today, INVOICE_DUE_SOON_DAYS);
  for (const invoice of input.dueSoonInvoices ?? []) {
    if (invoice.dueDate < input.today || invoice.dueDate > invoiceDueLimit) continue;
    alerts.push({
      id: `invoice-due-soon-${invoice.id}-${invoice.dueDate}`,
      type: "INVOICE_DUE_SOON",
      severity: "warning",
      headline: `Invoice ${invoice.invoiceNumber} is due soon`,
      explanation: `${invoice.customerName} has ${formatINR(invoice.outstandingPaise)} due on ${invoice.dueDate}.`,
      relatedRecordId: invoice.id,
      actionLabel: "Review invoice",
      actionHref: `/invoices/${invoice.id}`,
    });
  }

  const dueLimit = addDaysISO(input.today, BILL_DUE_SOON_DAYS);
  for (const bill of input.unpaidBills) {
    if (bill.dueDate < input.today || bill.dueDate > dueLimit) continue;
    alerts.push({
      id: `bill-due-soon-${bill.billId}-${bill.dueDate}`,
      type: "BILL_DUE_SOON",
      severity: "warning",
      headline: `${bill.title} is due soon`,
      explanation: `${formatINR(bill.amountPaise)} is due on ${bill.dueDate}.`,
      relatedRecordId: bill.billId,
      actionLabel: "View bills",
      actionHref: "/bills",
    });
  }

  for (const bill of input.pastDueBills ?? []) {
    alerts.push({
      id: `past-due-bill-${bill.billId}-${bill.dueDate}`,
      type: "PAST_DUE_BILL",
      severity: "critical",
      headline: `${bill.title} is past due`,
      explanation: `${formatINR(bill.amountPaise)} was due on ${bill.dueDate}; its settlement date is unknown.`,
      relatedRecordId: bill.billId,
      actionLabel: "Review bill",
      actionHref: "/bills?status=OVERDUE",
    });
  }

  if (input.cashShortfall) {
    alerts.unshift({
      id: `cash-shortfall-${input.cashShortfall.date}`,
      type: "CASH_SHORTFALL",
      severity: "critical",
      headline: `Cash shortfall projected on ${input.cashShortfall.date}`,
      explanation: `Projected cash falls as low as ${formatINR(input.cashShortfall.minimumCashPaise)} in the selected 30-day outlook.`,
      relatedRecordId: null,
      actionLabel: "Inspect forecast",
      actionHref: "/forecast?horizon=30",
    });
  }

  return alerts;
}
