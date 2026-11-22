import { prisma } from "@/lib/db/client";
import { todayKolkata } from "@/lib/financial/dates";
import { addDaysISO, occurrencesInRange } from "@/lib/financial/bills";
import { invoiceTotalPaise, outstandingPaise, paidTotalPaise } from "@/lib/financial/invoices";
import { computeForecast, type ForecastInput, type ForecastResult } from "@/lib/financial/forecast";
import { notFound, ServiceError } from "@/lib/services/errors";

export type ForecastHorizon = 30 | 60 | 90;

export const FORECAST_HORIZONS: readonly ForecastHorizon[] = [30, 60, 90];

const BUSINESS_PROFILE_ID = "local-business";

/** Bill occurrences this far back are loaded so overdue and recently paid items are visible. */
const BILL_LOOKBACK_DAYS = 366;

/** Pre-computed scenario result for one what-if delay. */
export type DelaySimulation = {
  baseline: ForecastResult;
  scenario: ForecastResult;
  invoiceId: string;
  originalDate: string | null;
  scenarioDate: string | null;
  differenceAtHorizonPaise: number;
};

/**
 * Loads everything the pure forecast engine needs. Read-only.
 * Bills: occurrences are materialised over [today - 366 days, today + horizonDays] for every
 * non-archived bill; persisted BillOccurrence rows overlay paidDate and a stored amount.
 */
export async function buildForecastInput(
  horizonDays: ForecastHorizon,
  shift?: { invoiceId: string; delayDays: number },
): Promise<ForecastInput> {
  const profile = await prisma.businessProfile.findUnique({
    where: { id: BUSINESS_PROFILE_ID },
    select: { openingCashPaise: true, openingCashDate: true },
  });
  if (!profile) {
    throw new ServiceError("NOT_FOUND", "Set up your business first");
  }

  const today = todayKolkata();

  const invoiceRows = await prisma.invoice.findMany({
    where: { lifecycle: { in: ["DRAFT", "ISSUED"] } },
    select: {
      id: true,
      invoiceNumber: true,
      lifecycle: true,
      dueDate: true,
      expectedCollectionDate: true,
      customer: { select: { name: true } },
      items: { select: { lineTotalPaise: true } },
      payments: { select: { paymentDate: true, amountPaise: true } },
    },
  });

  const from = addDaysISO(today, -BILL_LOOKBACK_DAYS);
  const to = addDaysISO(today, horizonDays);

  const bills = await prisma.bill.findMany({
    where: { archivedOn: null, firstDueDate: { lte: to } },
  });
  const persistedRows =
    bills.length === 0
      ? []
      : await prisma.billOccurrence.findMany({
          where: {
            billId: { in: bills.map((bill) => bill.id) },
            dueDate: { gte: from, lte: to },
          },
        });
  const persisted = new Map<string, (typeof persistedRows)[number]>();
  for (const row of persistedRows) {
    persisted.set(`${row.billId}|${row.dueDate}`, row);
  }

  const billOccurrences = bills.flatMap((bill) =>
    occurrencesInRange(bill, from, to).map((dueDate) => {
      const row = persisted.get(`${bill.id}|${dueDate}`);
      return {
        billId: bill.id,
        title: bill.title,
        dueDate,
        amountPaise: row?.amountPaise ?? bill.defaultAmountPaise,
        paidDate: row?.paidDate ?? null,
      };
    }),
  );

  return {
    today,
    horizonDays,
    opening: { cashPaise: profile.openingCashPaise, asOfDate: profile.openingCashDate },
    invoices: invoiceRows.map((row) => ({
      id: row.id,
      customerName: row.customer.name,
      invoiceNumber: row.invoiceNumber,
      lifecycle: row.lifecycle === "ISSUED" ? "ISSUED" : "DRAFT",
      dueDate: row.dueDate,
      expectedCollectionDate: row.expectedCollectionDate,
      totalPaise: invoiceTotalPaise(row.items),
      payments: row.payments.map((payment) => ({
        paymentDate: payment.paymentDate,
        amountPaise: payment.amountPaise,
      })),
    })),
    bills: billOccurrences,
    ...(shift ? { shift } : {}),
  };
}

/** Forecast with no what-if applied. */
export async function getForecast(horizonDays: ForecastHorizon): Promise<ForecastResult> {
  return computeForecast(await buildForecastInput(horizonDays));
}

/**
 * Compares the baseline forecast with one invoice's inflow delayed by delayDays.
 * Read-only: nothing is written. Both forecasts come from the same loaded input.
 */
export async function simulateDelay(
  invoiceId: string,
  delayDays: number,
  horizonDays: ForecastHorizon,
): Promise<DelaySimulation> {
  if (!Number.isInteger(delayDays) || delayDays < 1 || delayDays > 365) {
    throw new ServiceError("DOMAIN_RULE", "Delay must be a whole number of days from 1 to 365");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      lifecycle: true,
      items: { select: { lineTotalPaise: true } },
      payments: { select: { amountPaise: true } },
    },
  });
  if (!invoice) {
    throw notFound("Invoice");
  }
  if (invoice.lifecycle !== "ISSUED") {
    throw new ServiceError("DOMAIN_RULE", "Only issued invoices can be simulated");
  }
  const outstanding = outstandingPaise(
    invoiceTotalPaise(invoice.items),
    paidTotalPaise(invoice.payments),
  );
  if (outstanding <= 0) {
    throw new ServiceError("DOMAIN_RULE", "This invoice has nothing left to collect");
  }

  const input = await buildForecastInput(horizonDays);
  const baseline = computeForecast(input);
  if (baseline.uncertainInvoices.some((item) => item.invoiceId === invoiceId)) {
    throw new ServiceError("DOMAIN_RULE", "Set an expected collection date for this invoice first");
  }
  const scenario = computeForecast({ ...input, shift: { invoiceId, delayDays } });

  const originalDate =
    baseline.incomingEvents.find((event) => event.invoiceId === invoiceId)?.date ?? null;
  const scenarioDate =
    scenario.incomingEvents.find(
      (event) => event.invoiceId === invoiceId && event.basis === "SHIFTED_SCENARIO",
    )?.date ?? null;

  return {
    baseline,
    scenario,
    invoiceId,
    originalDate,
    scenarioDate,
    differenceAtHorizonPaise: scenario.endingCashPaise - baseline.endingCashPaise,
  };
}
