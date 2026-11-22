import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { formatINR } from "@/lib/financial/money";
import { listCustomers } from "@/lib/services/customers";
import { listInvoices, type InvoiceListFilters } from "@/lib/services/invoices";

type InvoicesPageProps = {
  searchParams: Promise<{
    status?: string;
    customerId?: string;
    search?: string;
    dueFrom?: string;
    dueTo?: string;
  }>;
};

const STATUS_OPTIONS: { value: NonNullable<InvoiceListFilters["status"]>; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED_UNPAID", label: "Issued, unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  const rawStatus = params.status ?? "";
  const status = STATUS_OPTIONS.find((option) => option.value === rawStatus)?.value;
  const customerId = params.customerId?.trim() || undefined;
  const search = params.search?.trim() || undefined;
  const dueFrom = params.dueFrom?.trim() || undefined;
  const dueTo = params.dueTo?.trim() || undefined;

  const [invoices, customers] = await Promise.all([
    listInvoices({ status, customerId, search, dueFrom, dueTo }),
    listCustomers(),
  ]);
  const hasFilters = Boolean(status || customerId || search || dueFrom || dueTo);

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <Link
          href="/invoices/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New invoice
        </Link>
      </div>

      <form method="GET" action="/invoices" className="mt-6 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-gray-700">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClass}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dueFrom" className="block text-xs font-medium text-gray-700">
            Due from
          </label>
          <input
            id="dueFrom"
            name="dueFrom"
            type="date"
            defaultValue={dueFrom ?? ""}
            className={selectClass}
          />
        </div>
        <div>
          <label htmlFor="dueTo" className="block text-xs font-medium text-gray-700">
            Due to
          </label>
          <input
            id="dueTo"
            name="dueTo"
            type="date"
            defaultValue={dueTo ?? ""}
            min={dueFrom}
            className={selectClass}
          />
        </div>
        <div>
          <label htmlFor="customerId" className="block text-xs font-medium text-gray-700">
            Customer
          </label>
          <select id="customerId" name="customerId" defaultValue={customerId ?? ""} className={selectClass}>
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="search" className="block text-xs font-medium text-gray-700">
            Search
          </label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Invoice number or customer"
            className={`${selectClass} w-64`}
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
        >
          Apply
        </button>
      </form>

      {invoices.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-600">
            {hasFilters ? "No invoices match these filters." : "No invoices yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                <th scope="col" className="px-4 py-3 font-medium">Issued</th>
                <th scope="col" className="px-4 py-3 font-medium">Due</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Received</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{invoice.customer.name}</td>
                  <td className="px-4 py-3 text-gray-700">{invoice.issueDate}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {invoice.dueDate}
                    {invoice.overdueDays > 0 && (
                      <span className="ml-2 text-xs font-medium text-red-700">
                        {invoice.overdueDays} {invoice.overdueDays === 1 ? "day" : "days"} overdue
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatINR(invoice.totalPaise)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatINR(invoice.paidPaise)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatINR(invoice.outstandingPaise)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {STATUS_LABELS[invoice.status] ?? invoice.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
