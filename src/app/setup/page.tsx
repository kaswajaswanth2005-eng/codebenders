import { redirect } from "next/navigation";
import { BusinessForm } from "@/components/business/business-form";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const existing = await prisma.businessProfile.findUnique({
    where: { id: "local-business" },
    select: { id: true },
  });

  if (existing) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Set up your business</h1>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <BusinessForm mode="create" />
      </div>
    </main>
  );
}
