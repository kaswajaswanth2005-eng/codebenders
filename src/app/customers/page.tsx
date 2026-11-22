import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { formatINR } from "@/lib/financial/money";
import { listCustomers } from "@/lib/services/customers";

type CustomersPageProps = {
  searchParams: Promise<{ search?: string }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { search } = await searchParams;
  const term = search?.trim() ?? "";
  const customers = await listCustomers({ search: term || undefined });

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
        <Link
          href="/customers/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New customer
        </Link>
      </div>

      <form method="GET" action="/customers" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="search" className="sr-only">
          Search customers
        </label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={term}
          placeholder="Search by name, company, email or phone"
          className="w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
        >
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-600">
            {term
              ? `No customers match "${term}".`
              : "No customers yet. Add your first client to start invoicing."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Company</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Overdue</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Unpaid invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="font-medium text-gray-900 hover:underline">
                      {customer.name}
                    </Link>
                    {customer.archivedAt && (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{customer.companyName ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {formatINR(customer.summary.outstandingPaise)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-700">
                    {formatINR(customer.summary.overdueOutstandingPaise)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {customer.summary.openInvoiceCount}
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
