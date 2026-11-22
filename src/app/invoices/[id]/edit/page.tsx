import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { InvoiceForm, type CustomerOption } from "@/components/invoices/invoice-form";
import { todayKolkata } from "@/lib/financial/dates";
import { ServiceError } from "@/lib/services/errors";
import { listCustomers } from "@/lib/services/customers";
import { getInvoiceDetail } from "@/lib/services/invoices";

type EditInvoicePageProps = {
  params: Promise<{ id: string }>;
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

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const { id } = await params;
  const invoice = await loadInvoice(id);

  if (invoice.lifecycle !== "DRAFT") {
    return (
      <AppShell>
        <h1 className="text-2xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <p className="font-medium text-gray-900">Issued invoices cannot be edited.</p>
          <Link href={`/invoices/${invoice.id}`} className="mt-2 inline-block text-sm text-gray-700 underline">
            Back to invoice
          </Link>
        </div>
      </AppShell>
    );
  }

  const customers: CustomerOption[] = (await listCustomers()).map((customer) => ({
    id: customer.id,
    name: customer.name,
  }));
  // The assigned customer may be archived, which listCustomers hides; keep it selectable.
  if (!customers.some((customer) => customer.id === invoice.customer.id)) {
    customers.push({ id: invoice.customer.id, name: invoice.customer.name });
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-gray-900">Edit draft {invoice.invoiceNumber}</h1>
      <div className="mt-6 max-w-3xl rounded-lg border border-gray-200 bg-white p-6">
        <InvoiceForm
          mode="edit"
          invoiceId={invoice.id}
          customers={customers}
          defaultDate={todayKolkata()}
          initial={{
            customerId: invoice.customer.id,
            invoiceNumber: invoice.invoiceNumber,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            expectedCollectionDate: invoice.expectedCollectionDate ?? "",
            notes: invoice.notes ?? "",
            paymentInstructions: invoice.paymentInstructions ?? "",
            items: invoice.items.map((item) => ({
              description: item.description,
              quantity: String(item.quantityMilli / 1000),
              unitPrice: (item.unitPricePaise / 100).toFixed(2),
            })),
          }}
        />
      </div>
    </AppShell>
  );
}
