import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ForecastChart } from "@/components/forecast/forecast-chart";
import { Simulator, type SimulatorInvoice } from "@/components/forecast/simulator";
import { formatDisplayDate } from "@/components/forecast/format";
import { formatINR } from "@/lib/financial/money";
import type { ForecastResult } from "@/lib/financial/forecast";
import {
  FORECAST_HORIZONS,
  getForecast,
  type ForecastHorizon,
} from "@/lib/services/forecast";
import { listInvoices } from "@/lib/services/invoices";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ horizon?: string | string[] }>;
};

const BASIS_LABELS: Record<ForecastResult["incomingEvents"][number]["basis"], string> = {
  OWNER_ESTIMATE: "Your estimated date",
  INVOICE_DUE_DATE: "Due date assumed",
  SHIFTED_SCENARIO: "Shifted by simulation",
};

function parseHorizon(raw: string | string[] | undefined): ForecastHorizon {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return FORECAST_HORIZONS.find((horizon) => String(horizon) === value) ?? 30;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-gray-600">{detail}</p> : null}
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="px-4 py-6 text-sm text-gray-600">{children}</p>;
}

export default async function ForecastPage({ searchParams }: PageProps) {
  const horizon = parseHorizon((await searchParams).horizon);

  const [forecast, invoiceRows] = await Promise.all([getForecast(horizon), listInvoices()]);

  const invoices: SimulatorInvoice[] = invoiceRows
    .filter((row) => row.lifecycle === "ISSUED" && row.outstandingPaise > 0)
    .map((row) => ({
      id: row.id,
      label: `${row.invoiceNumber} · ${row.customer.name}`,
      outstandingPaise: row.outstandingPaise,
      expectedDate: row.expectedCollectionDate,
    }));

  const lastPoint = forecast.points[forecast.points.length - 1];
  const shortfallSummary = forecast.firstShortfallDate
    ? `Cash is projected to go below zero on ${formatDisplayDate(forecast.firstShortfallDate)} (lowest ${formatINR(forecast.minimumCashPaise)} on ${formatDisplayDate(forecast.minimumCashDate)}). Review the invoices and bills below.`
    : `No projected shortfall within ${horizon} days.`;

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-gray-900">Cash Forecast</h1>

      <nav aria-label="Forecast horizon" className="mt-4 flex gap-2">
        {FORECAST_HORIZONS.map((days) => {
          const active = days === horizon;
          return (
            <a
              key={days}
              href={`?horizon=${days}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                active
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
              }`}
            >
              {days} days
            </a>
          );
        })}
      </nav>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Recorded cash today" value={formatINR(forecast.recordedCashPaise)} />
        <SummaryCard
          label={`Projected cash at day ${horizon}`}
          value={formatINR(forecast.endingCashPaise)}
          detail={formatDisplayDate(lastPoint.date)}
        />
        <SummaryCard
          label="Lowest projected cash"
          value={formatINR(forecast.minimumCashPaise)}
          detail={formatDisplayDate(forecast.minimumCashDate)}
        />
        <SummaryCard
          label="First shortfall"
          value={
            forecast.firstShortfallDate
              ? formatDisplayDate(forecast.firstShortfallDate)
              : "No shortfall in this window"
          }
        />
        <SummaryCard
          label="Negative days"
          value={String(forecast.negativeDays)}
          detail="Days with projected cash below zero"
        />
      </section>

      <p className="mt-4 text-sm text-gray-800">{shortfallSummary}</p>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <ForecastChart points={forecast.points} horizonDays={horizon} />
      </section>

      <section className="mt-6" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading" className="text-lg font-semibold text-gray-900">
          Expected money in
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {forecast.incomingEvents.length === 0 ? (
            <EmptyState>No invoice payments are expected in this window.</EmptyState>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-gray-700">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-2 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2 font-medium">Basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {forecast.incomingEvents.map((event) => (
                  <tr key={`${event.invoiceId}|${event.date}|${event.basis}`}>
                    <td className="px-4 py-2 text-gray-900">{formatDisplayDate(event.date)}</td>
                    <td className="px-4 py-2 text-gray-900">{event.customerName}</td>
                    <td className="px-4 py-2 text-gray-900">{event.invoiceNumber}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatINR(event.amountPaise)}</td>
                    <td className="px-4 py-2 text-gray-700">{BASIS_LABELS[event.basis]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="outgoing-heading">
        <h2 id="outgoing-heading" className="text-lg font-semibold text-gray-900">
          Expected bill payments
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {forecast.outgoingEvents.length === 0 ? (
            <EmptyState>No bill payments are due in this window.</EmptyState>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-gray-700">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2 font-medium">Bill</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {forecast.outgoingEvents.map((event) => (
                  <tr key={`${event.billId}|${event.date}`}>
                    <td className="px-4 py-2 text-gray-900">{formatDisplayDate(event.date)}</td>
                    <td className="px-4 py-2 text-gray-900">{event.title}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatINR(event.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="uncertain-heading">
        <h2 id="uncertain-heading" className="text-lg font-semibold text-gray-900">
          Invoices without a dated collection
        </h2>
        <div className="mt-2 rounded-lg border border-gray-200 bg-white">
          {forecast.uncertainInvoices.length === 0 ? (
            <EmptyState>Every outstanding invoice has a dated collection estimate.</EmptyState>
          ) : (
            <ul className="divide-y divide-gray-100">
              {forecast.uncertainInvoices.map((item) => (
                <li key={item.invoiceId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.invoiceNumber} · {item.customerName}
                    </p>
                    <p className="text-gray-600">
                      {formatINR(item.outstandingPaise)} outstanding. Overdue — no expected date. Set one on the
                      invoice to include it.
                    </p>
                  </div>
                  <Link href={`/invoices/${item.invoiceId}`} className="text-sm font-medium text-gray-900 underline">
                    Open invoice
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="overdue-bills-heading">
        <h2 id="overdue-bills-heading" className="text-lg font-semibold text-gray-900">
          Overdue bills
        </h2>
        <div className="mt-2 rounded-lg border border-gray-200 bg-white">
          {forecast.overdueBills.length === 0 ? (
            <EmptyState>No bills are overdue.</EmptyState>
          ) : (
            <ul className="divide-y divide-gray-100">
              {forecast.overdueBills.map((bill) => (
                <li
                  key={`${bill.billId}|${bill.dueDate}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {bill.title} · due {formatDisplayDate(bill.dueDate)}
                    </p>
                    <p className="text-gray-600">
                      {formatINR(bill.amountPaise)}. Past due, settlement unknown.
                    </p>
                  </div>
                  <Link href="/bills" className="text-sm font-medium text-gray-900 underline">
                    Open bills
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="simulator-heading">
        <h2 id="simulator-heading" className="text-lg font-semibold text-gray-900">
          What if an invoice is paid late?
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Choose an issued invoice and a delay to compare the projection. Nothing is saved.
        </p>
        <div className="mt-4">
          <Simulator invoices={invoices} horizonDays={horizon} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4" aria-labelledby="assumptions-heading">
        <h2 id="assumptions-heading" className="text-lg font-semibold text-gray-900">
          Assumptions
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          {forecast.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
