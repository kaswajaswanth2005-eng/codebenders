import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { BusinessForm, type BusinessFormInitial } from "@/components/business/business-form";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await prisma.businessProfile.findUnique({
    where: { id: "local-business" },
  });

  if (!profile) {
    redirect("/setup");
  }

  const initial: BusinessFormInitial = {
    businessName: profile.businessName,
    ownerName: profile.ownerName,
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    openingCashRupees: (profile.openingCashPaise / 100).toFixed(2),
    openingCashDate: profile.openingCashDate,
    paymentInstructions: profile.paymentInstructions ?? "",
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
      <div className="mt-6 max-w-2xl rounded-lg border border-gray-200 bg-white p-6">
        <BusinessForm mode="edit" initial={initial} />
      </div>
    </AppShell>
  );
}
