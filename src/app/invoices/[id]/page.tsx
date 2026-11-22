import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { ExpectedCollectionForm } from "@/components/invoices/expected-collection-form";
import { todayKolkata } from "@/lib/financial/dates";
import { formatINR } from "@/lib/financial/money";
import { ServiceError } from "@/lib/services/errors";
import { getInvoiceDetail } from "@/lib/services/invoices";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED_UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-800",
  ISSUED_UNPAID: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-900",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

async function loadInvoice(id: string) {
  try {
    return await getInvoiceDetail(id);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;
  const invoice = await loadInvoice(id);
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status;
  const statusClass = STATUS_CLASSES[invoice.status] ?? "bg-gray-200 text-gray-800";

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-700">
            Customer:{" "}
            <Link href={`/customers/${invoice.customer.id}`} className="font-medium text-gray-900 hover:underline">
              {invoice.customer.name}
            </Link>
            {invoice.customer.companyName ? ` (${invoice.customer.companyName})` : ""}
          </p>
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          lifecycle={invoice.lifecycle}
          outstandingPaise={invoice.outstandingPaise}
          defaultDate={todayKolkata()}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-gray-600">Issue date</dt>
                <dd className="mt-1 font-medium text-gray-900">{invoice.issueDate}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Due date</dt>
                <dd className="mt-1 font-medium text-gray-900">{invoice.dueDate}</dd>
              </div>
              <div>
                <dt className="text-gray-600">Expected collection</dt>
                <dd className="mt-1 font-medium text-gray-900">{invoice.expectedCollectionDate ?? "—"}</dd>
              </div>
            </dl>
            {invoice.overdueDays > 0 && (
              <p className="mt-3 text-sm font-medium text-red-700">
                {invoice.overdueDays} {invoice.overdueDays === 1 ? "day" : "days"} overdue
              </p>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Items</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Description</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Qty</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Unit price</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {(item.quantityMilli / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatINR(item.unitPricePaise)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatINR(item.lineTotalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Payments</h2>
            {invoice.payments.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-600">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Date</th>
                      <th scope="col" className="px-4 py-3 font-medium">Method</th>
                      <th scope="col" className="px-4 py-3 font-medium">Reference</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 text-gray-700">{payment.paymentDate}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {METHOD_LABELS[payment.method] ?? payment.method}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{payment.referenceNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatINR(payment.amountPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {(invoice.notes || invoice.paymentInstructions) && (
            <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 text-sm">
              {invoice.notes && (
                <div>
                  <h2 className="font-semibold text-gray-900">Notes</h2>
                  <p className="mt-1 whitespace-pre-line text-gray-700">{invoice.notes}</p>
                </div>
              )}
              {invoice.paymentInstructions && (
                <div>
                  <h2 className="font-semibold text-gray-900">Payment instructions</h2>
                  <p className="mt-1 whitespace-pre-line text-gray-700">{invoice.paymentInstructions}</p>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Totals</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Total</dt>
                <dd className="font-medium text-gray-900">{formatINR(invoice.totalPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Received</dt>
                <dd className="font-medium text-gray-900">{formatINR(invoice.paidPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="text-gray-600">Outstanding</dt>
                <dd className="font-semibold text-gray-900">{formatINR(invoice.outstandingPaise)}</dd>
              </div>
            </dl>
          </section>
          {invoice.lifecycle === "ISSUED" && invoice.outstandingPaise > 0 && (
            <ExpectedCollectionForm
              invoiceId={invoice.id}
              initialDate={invoice.expectedCollectionDate}
              minimumDate={todayKolkata()}
            />
          )}
        </aside>
      </div>
    </AppShell>
  );
}
