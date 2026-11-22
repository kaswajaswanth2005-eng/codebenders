import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { CustomerForm } from "@/components/customers/customer-form";
import { getCustomerDetail } from "@/lib/services/customers";

type EditCustomerPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  let detail: Awaited<ReturnType<typeof getCustomerDetail>>;
  try {
    detail = await getCustomerDetail(id);
  } catch {
    notFound();
  }
  const { customer } = detail;

  return (
    <AppShell>
      <Link href={`/customers/${customer.id}`} className="text-sm text-gray-600 hover:underline">
        ← Back to {customer.name}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">Edit customer</h1>
      <div className="mt-6 max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
        <CustomerForm
          mode="edit"
          customerId={customer.id}
          initial={{
            name: customer.name,
            companyName: customer.companyName ?? "",
            email: customer.email ?? "",
            phone: customer.phone ?? "",
            address: customer.address ?? "",
            notes: customer.notes ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
