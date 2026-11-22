/**
 * Pure cash-forecast engine. No Prisma, no I/O, no clock reads: callers pass "today".
 * Money is integer paise. Dates are YYYY-MM-DD strings; all date arithmetic goes through
 * Date.UTC (via addDaysISO), never local-timezone parsing.
 */
import { isValidISODate } from "./dates";
import { addDaysISO, classifyOccurrence } from "./bills";
import { outstandingPaise, paidTotalPaise } from "./invoices";

export type ForecastInput = {
  today: string; // YYYY-MM-DD, Asia/Kolkata day
  horizonDays: 30 | 60 | 90;
  opening: { cashPaise: number; asOfDate: string };
  invoices: Array<{
    id: string;
    customerName: string;
    invoiceNumber: string;
    lifecycle: "DRAFT" | "ISSUED";
    dueDate: string;
    expectedCollectionDate: string | null;
    totalPaise: number;
    payments: Array<{ paymentDate: string; amountPaise: number }>; // ALL recorded payments for this invoice
  }>;
  bills: Array<{
    billId: string;
    title: string;
    dueDate: string; // materialised occurrences
    amountPaise: number;
    paidDate: string | null;
  }>;
  shift?: { invoiceId: string; delayDays: number }; // what-if: move ONE invoice's scheduled inflow
};

export type ForecastResult = {
  asOfDate: string;
  horizonDays: number;
  recordedCashPaise: number;
  points: Array<{ date: string; incomingPaise: number; outgoingPaise: number; closingCashPaise: number }>;
  endingCashPaise: number;
  minimumCashPaise: number;
  minimumCashDate: string;
  firstShortfallDate: string | null;
  negativeDays: number;
  incomingEvents: Array<{
    date: string;
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    amountPaise: number;
    basis: "OWNER_ESTIMATE" | "INVOICE_DUE_DATE" | "SHIFTED_SCENARIO";
  }>;
  outgoingEvents: Array<{ date: string; billId: string; title: string; amountPaise: number }>;
  uncertainInvoices: Array<{ invoiceId: string; invoiceNumber: string; customerName: string; outstandingPaise: number }>;
  overdueBills: Array<{ billId: string; title: string; dueDate: string; amountPaise: number }>;
  assumptions: string[];
};

const ASSUMPTIONS: readonly string[] = [
  "Day-end cash: same-day events are netted",
  "Invoice due dates are estimated receipt dates, not guarantees",
  "Overdue invoices without an updated expected date are excluded from dated inflows",
  "Overdue unpaid bills have unknown settlement dates and are excluded from dated outflows",
  "Recorded cash counts only transactions entered in CashPilot after the opening snapshot date",
];

type Inflow = ForecastResult["incomingEvents"][number];

export function computeForecast(input: ForecastInput): ForecastResult {
  const { today, horizonDays, opening, invoices, bills, shift } = input;

  if (!isValidISODate(today)) {
    throw new RangeError("today must be a valid YYYY-MM-DD date");
  }
  if (!isValidISODate(opening.asOfDate)) {
    throw new RangeError("opening.asOfDate must be a valid YYYY-MM-DD date");
  }
  if (shift !== undefined && !Number.isInteger(shift.delayDays)) {
    throw new RangeError("shift.delayDays must be an integer");
  }

  const horizonEnd = addDaysISO(today, horizonDays);
  const asOf = opening.asOfDate;

  // A. Recorded cash: snapshot plus transactions strictly after asOf, up to and including today.
  let recordedCashPaise = opening.cashPaise;
  for (const invoice of invoices) {
    for (const payment of invoice.payments) {
      if (payment.paymentDate > asOf && payment.paymentDate <= today) {
        recordedCashPaise += payment.amountPaise;
      }
    }
  }
  for (const bill of bills) {
    if (bill.paidDate !== null && bill.paidDate > asOf && bill.paidDate <= today) {
      recordedCashPaise -= bill.amountPaise;
    }
  }

  // B. Invoice inflows (before any what-if shift).
  const inflows: Inflow[] = [];
  const uncertainInvoices: ForecastResult["uncertainInvoices"] = [];
  for (const invoice of invoices) {
    if (invoice.lifecycle !== "ISSUED") continue;

    const paid = paidTotalPaise(invoice.payments);
    const outstanding = outstandingPaise(invoice.totalPaise, paid);
    if (outstanding <= 0) continue;

    const ref = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
    };

    if (invoice.expectedCollectionDate !== null) {
      if (invoice.expectedCollectionDate >= today) {
        inflows.push({
          ...ref,
          date: invoice.expectedCollectionDate,
          amountPaise: outstanding,
          basis: "OWNER_ESTIMATE",
        });
      } else {
        uncertainInvoices.push({ ...ref, outstandingPaise: outstanding });
      }
    } else if (invoice.dueDate >= today) {
      inflows.push({
        ...ref,
        date: invoice.dueDate,
        amountPaise: outstanding,
        basis: "INVOICE_DUE_DATE",
      });
    } else {
      uncertainInvoices.push({ ...ref, outstandingPaise: outstanding });
    }
  }

  // F. What-if: move the matching eligible inflow. Ineligible or unknown invoices are ignored.
  // Built as a new array so the input objects are never mutated.
  const scheduledInflows: Inflow[] = shift
    ? inflows.map((flow) =>
        flow.invoiceId === shift.invoiceId
          ? {
              ...flow,
              date: addDaysISO(flow.date, shift.delayDays),
              basis: "SHIFTED_SCENARIO" as const,
            }
          : flow,
      )
    : inflows;

  // Only inflows inside [today, today + horizonDays] count; later ones are excluded, not clamped.
  const incomingEvents = scheduledInflows
    .filter((flow) => flow.date >= today && flow.date <= horizonEnd)
    .map((flow) => ({ ...flow }))
    .sort((a, b) => (a.date === b.date ? (a.invoiceNumber < b.invoiceNumber ? -1 : a.invoiceNumber > b.invoiceNumber ? 1 : 0) : a.date < b.date ? -1 : 1));

  // C. Bill outflows.
  const outgoingEvents: ForecastResult["outgoingEvents"] = [];
  const overdueBills: ForecastResult["overdueBills"] = [];
  for (const bill of bills) {
    if (bill.paidDate !== null) continue;
    const status = classifyOccurrence(bill.dueDate, bill.paidDate, today);
    if (status === "OVERDUE") {
      overdueBills.push({
        billId: bill.billId,
        title: bill.title,
        dueDate: bill.dueDate,
        amountPaise: bill.amountPaise,
      });
    } else if (bill.dueDate <= horizonEnd) {
      outgoingEvents.push({
        date: bill.dueDate,
        billId: bill.billId,
        title: bill.title,
        amountPaise: bill.amountPaise,
      });
    }
  }
  outgoingEvents.sort((a, b) =>
    a.date === b.date ? (a.billId < b.billId ? -1 : a.billId > b.billId ? 1 : 0) : a.date < b.date ? -1 : 1,
  );

  // D. Daily running balance, today through today + horizonDays inclusive.
  const incomingByDate = new Map<string, number>();
  for (const flow of incomingEvents) {
    incomingByDate.set(flow.date, (incomingByDate.get(flow.date) ?? 0) + flow.amountPaise);
  }
  const outgoingByDate = new Map<string, number>();
  for (const event of outgoingEvents) {
    outgoingByDate.set(event.date, (outgoingByDate.get(event.date) ?? 0) + event.amountPaise);
  }

  const points: ForecastResult["points"] = [];
  let closing = recordedCashPaise;
  for (let offset = 0; offset <= horizonDays; offset++) {
    const date = addDaysISO(today, offset);
    const incomingPaise = incomingByDate.get(date) ?? 0;
    const outgoingPaise = outgoingByDate.get(date) ?? 0;
    closing = closing + incomingPaise - outgoingPaise;
    points.push({ date, incomingPaise, outgoingPaise, closingCashPaise: closing });
  }

  // E. Summary figures.
  let minIndex = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].closingCashPaise < points[minIndex].closingCashPaise) {
      minIndex = i;
    }
  }
  const firstShortfallDate = points.find((point) => point.closingCashPaise < 0)?.date ?? null;
  const negativeDays = points.filter((point) => point.closingCashPaise < 0).length;

  return {
    asOfDate: asOf,
    horizonDays,
    recordedCashPaise,
    points,
    endingCashPaise: points[points.length - 1].closingCashPaise,
    minimumCashPaise: points[minIndex].closingCashPaise,
    minimumCashDate: points[minIndex].date,
    firstShortfallDate,
    negativeDays,
    incomingEvents,
    outgoingEvents,
    uncertainInvoices,
    overdueBills,
    assumptions: [...ASSUMPTIONS],
  };
}
