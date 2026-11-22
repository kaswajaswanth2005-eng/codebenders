import { AppShell } from "@/components/layout/app-shell";
import { BillForm } from "@/components/bills/bill-form";

export const dynamic = "force-dynamic";

export default function NewBillPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-gray-900">New bill</h1>
      <p className="mt-1 text-sm text-gray-600">
        Add a one-time bill or a monthly bill such as rent or a subscription.
      </p>
      <div className="mt-6 max-w-xl rounded-lg border border-gray-200 bg-white p-6">
        <BillForm mode="create" />
      </div>
    </AppShell>
  );
}
