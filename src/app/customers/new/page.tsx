import { AppShell } from "@/components/layout/app-shell";
import { CustomerForm } from "@/components/customers/customer-form";

export default function NewCustomerPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-gray-900">New customer</h1>
      <div className="mt-6 max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
        <CustomerForm mode="create" />
      </div>
    </AppShell>
  );
}
