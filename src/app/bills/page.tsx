import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { MarkPaidButton } from "@/components/bills/mark-paid-button";
import { addDaysISO, dueSoon } from "@/lib/financial/bills";
import { formatINR } from "@/lib/financial/money";
import { todayKolkata } from "@/lib/financial/dates";
import { parseBillRange } from "@/lib/schemas/bills";
import { listBillOccurrences } from "@/lib/services/bills";

export const dynamic = "force-dynamic";

type BillsPageProps = {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
};

function StatusBadge({ status, paidDate, dueDate, today }: {
  status: "PAID" | "OVERDUE" | "UPCOMING";
  paidDate: string | null;
  dueDate: string;
  today: string;
}) {
  if (status === "PAID") {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Paid {paidDate}
      </span>
    );
  }
  if (status === "OVERDUE") {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        Overdue
      </span>
    );
  }
  const soon = dueSoon(dueDate, today);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        soon ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"
      }`}
    >
      Upcoming
    </span>
  );
}

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const params = await searchParams;
  const today = todayKolkata();
  const status = ["PAID", "OVERDUE", "UPCOMING"].includes(params.status ?? "")
    ? (params.status as "PAID" | "OVERDUE" | "UPCOMING")
    : undefined;
  const defaultFrom = status === "OVERDUE" ? addDaysISO(today, -365) : null;
  const defaultTo = status === "OVERDUE" ? today : null;
  const range = parseBillRange(params.from ?? defaultFrom, params.to ?? defaultTo);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Expenses &amp; Bills</h1>
        <Link
          href="/bills/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New bill
        </Link>
      </div>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 text-sm">
        <div>
          <label htmlFor="status" className="block font-medium text-gray-800">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All statuses</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="OVERDUE">Overdue</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <div>
          <label htmlFor="from" className="block font-medium text-gray-800">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={range.success ? range.data.from : today}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <div>
          <label htmlFor="to" className="block font-medium text-gray-800">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={range.success ? range.data.to : ""}
            className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          Show
        </button>
      </form>

      {!range.success ? (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {range.error.issues[0]?.message ?? "Please correct the date range."}
        </p>
      ) : (
        <BillsTable range={range.data} today={today} status={status} />
      )}
    </AppShell>
  );
}

async function BillsTable({
  range,
  today,
  status,
}: {
  range: { from: string; to: string };
  today: string;
  status?: "PAID" | "OVERDUE" | "UPCOMING";
}) {
  const rows = await listBillOccurrences(range, status);

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">
        No bills yet. Add rent, salaries or subscriptions to see them in your forecast.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Title</th>
            <th scope="col" className="px-4 py-3 font-medium">Category</th>
            <th scope="col" className="px-4 py-3 font-medium">Due date</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={`${row.billId}-${row.dueDate}`}>
              <td className="px-4 py-3 text-gray-900">
                <Link href={`/bills/${row.billId}/edit`} className="font-medium hover:underline">
                  {row.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-700">{row.category}</td>
              <td className="px-4 py-3 text-gray-700">{row.dueDate}</td>
              <td className="px-4 py-3 text-right text-gray-900">{formatINR(row.amountPaise)}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={row.status}
                  paidDate={row.paidDate}
                  dueDate={row.dueDate}
                  today={today}
                />
              </td>
              <td className="px-4 py-3">
                {row.status !== "PAID" && (
                  <MarkPaidButton
                    billId={row.billId}
                    dueDate={row.dueDate}
                    amountPaise={row.amountPaise}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
