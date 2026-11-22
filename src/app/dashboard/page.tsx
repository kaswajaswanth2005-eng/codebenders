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
    <div className="ui-card group p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_16px_40px_rgba(79,70,229,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>}
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
      <h1 className="ui-page-title">Dashboard</h1>
      <p className="mt-1 text-sm font-medium text-slate-500">{profile.businessName}</p>

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

      <section className="ui-card mt-6 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">30-day cash outlook</h2>
            <p className="mt-1 text-sm text-slate-500">
              Day-end projection from recorded cash, expected receipts and unpaid bills.
            </p>
          </div>
          <Link href="/forecast?horizon=30" className="ui-primary-button">
            Open forecast
          </Link>
        </div>
        <ForecastChart points={forecast.points} horizonDays={30} />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="ui-card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-950">Who owes money</h2>
              <p className="mt-0.5 text-xs text-slate-500">Open receivables and due dates</p>
            </div>
          </div>
          {receivables.length === 0 ? (
            <p className="p-4 text-sm text-gray-700">Nothing is owed right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-5 py-3">Customer</th>
                    <th scope="col" className="px-5 py-3">Invoice</th>
                    <th scope="col" className="px-5 py-3 text-right">Outstanding</th>
                    <th scope="col" className="px-5 py-3">Due date</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receivables.map((row) => (
                    <tr key={row.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{row.customer.name}</td>
                      <td className="px-5 py-3.5">
                        <Link href={`/invoices/${row.id}`} className="font-semibold text-indigo-600 hover:text-indigo-800">
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-950">{formatINR(row.outstandingPaise)}</td>
                      <td className="px-5 py-3.5 text-slate-500">{row.dueDate}</td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.overdue ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {row.overdue ? `${row.overdueDays}d overdue` : "Not yet due"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="ui-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-950">Action Center</h2>
            <p className="mt-0.5 text-xs text-slate-500">Priorities for today</p>
          </div>
          {alerts.length === 0 ? (
            <p className="p-5 text-sm text-slate-600">No alerts. Nothing needs action today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <li key={alert.id} className="p-5">
                  <p className={`text-sm font-bold ${alert.severity === "critical" ? "text-rose-700" : "text-amber-700"}`}>
                    {alert.headline}
                  </p>
                  <p className="mt-1.5 text-sm leading-5 text-slate-600">{alert.explanation}</p>
                  <Link
                    href={alert.actionHref}
                    className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {alert.actionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ui-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Upcoming bills</h2>
            <p className="mt-0.5 text-xs text-slate-500">Next 7 days</p>
          </div>
          <Link href="/bills" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            View all
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
