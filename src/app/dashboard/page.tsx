import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ForecastChart } from "@/components/forecast/forecast-chart";
import { formatINR } from "@/lib/financial/money";
import { getDashboardData } from "@/lib/services/dashboard";
import { ServiceError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

const RECEIVABLES_LIMIT = 10;
const UPCOMING_BILLS_LIMIT = 7;

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  let data;
  try {
    data = await getDashboardData(30);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") {
      redirect("/setup");
    }
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          We could not load your business details. Check that the database is migrated.
        </div>
      </AppShell>
    );
  }
  const { profile, summary, forecast, alerts } = data;
  const receivables = data.receivables.slice(0, RECEIVABLES_LIMIT);
  const upcomingBills = data.upcomingBills.slice(0, UPCOMING_BILLS_LIMIT);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-600">{profile.businessName}</p>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Recorded cash"
          value={formatINR(summary.recordedCashPaise)}
          detail={`From snapshot dated ${profile.openingCashDate}`}
        />
        <SummaryCard
          label="Total outstanding"
          value={formatINR(summary.totalOutstandingPaise)}
          detail={`${summary.openInvoiceCount} open ${summary.openInvoiceCount === 1 ? "invoice" : "invoices"}`}
        />
        <SummaryCard
          label="Overdue"
          value={formatINR(summary.overduePaise)}
          detail={`${summary.overdueInvoiceCount} ${summary.overdueInvoiceCount === 1 ? "invoice" : "invoices"} overdue`}
        />
        <SummaryCard
          label="Bills due in next 30 days"
          value={formatINR(summary.upcomingBillsPaise)}
          detail={`${summary.upcomingBillCount} unpaid ${summary.upcomingBillCount === 1 ? "bill" : "bills"}`}
        />
        <SummaryCard
          label="Projected cash (30 days)"
          value={formatINR(summary.projectedCashPaise)}
          detail={forecast.firstShortfallDate ? `Shortfall starts ${forecast.firstShortfallDate}` : "No projected shortfall"}
        />
        <SummaryCard
          label="Overdue invoices"
          value={String(summary.overdueInvoiceCount)}
          detail="Needs collection follow-up"
        />
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">30-day cash outlook</h2>
            <p className="text-sm text-gray-600">
              Day-end projection from recorded cash, expected receipts and unpaid bills.
            </p>
          </div>
          <Link href="/forecast?horizon=30" className="text-sm font-medium text-gray-900 underline">
            Open full forecast
          </Link>
        </div>
        <ForecastChart points={forecast.points} horizonDays={30} />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white lg:col-span-2">
          <h2 className="border-b border-gray-200 px-4 py-3 text-base font-semibold text-gray-900">
            Who owes money
          </h2>
          {receivables.length === 0 ? (
            <p className="p-4 text-sm text-gray-700">Nothing is owed right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Customer</th>
                    <th scope="col" className="px-4 py-2 font-medium">Invoice</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Outstanding</th>
                    <th scope="col" className="px-4 py-2 font-medium">Due date</th>
                    <th scope="col" className="px-4 py-2 font-medium">Days overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receivables.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2 text-gray-900">{row.customer.name}</td>
                      <td className="px-4 py-2">
                        <Link href={`/invoices/${row.id}`} className="text-gray-900 underline">
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900">
                        {formatINR(row.outstandingPaise)}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{row.dueDate}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {row.overdue ? row.overdueDays : "Not yet due"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white">
          <h2 className="border-b border-gray-200 px-4 py-3 text-base font-semibold text-gray-900">
            Action Center
          </h2>
          {alerts.length === 0 ? (
            <p className="p-4 text-sm text-gray-700">No alerts. Nothing needs action today.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {alerts.map((alert) => (
                <li key={alert.id} className="p-4">
                  <p
                    className={`text-sm font-medium ${
                      alert.severity === "critical" ? "text-red-700" : "text-amber-800"
                    }`}
                  >
                    {alert.headline}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{alert.explanation}</p>
                  <Link
                    href={alert.actionHref}
                    className="mt-2 inline-block rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    {alert.actionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Upcoming bills (next 7 days)</h2>
          <Link href="/bills" className="text-sm text-gray-700 underline">
            All bills
          </Link>
        </div>
        {upcomingBills.length === 0 ? (
          <p className="p-4 text-sm text-gray-700">No unpaid bills due in the next 7 days.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcomingBills.map((row) => (
              <li
                key={`${row.billId}-${row.dueDate}`}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-gray-900">
                  {row.title} <span className="text-gray-500">due {row.dueDate}</span>
                </span>
                <span className="text-gray-900">{formatINR(row.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
