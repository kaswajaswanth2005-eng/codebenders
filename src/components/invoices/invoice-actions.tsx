"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaymentForm } from "@/components/invoices/payment-form";
import { ReminderPanel } from "@/components/invoices/reminder-panel";

interface InvoiceActionsProps {
  invoiceId: string;
  lifecycle: string;
  outstandingPaise: number;
  defaultDate: string;
}

export function InvoiceActions({ invoiceId, lifecycle, outstandingPaise, defaultDate }: InvoiceActionsProps) {
  const router = useRouter();
  const [showPayment, setShowPayment] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDraft = lifecycle === "DRAFT";
  const isIssued = lifecycle === "ISSUED";
  const canRecordPayment = isIssued && outstandingPaise > 0;

  async function handleIssue() {
    if (!window.confirm("Issue this invoice? Items and amounts will be locked.")) {
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/issue`, { method: "POST" });
      let json: { success?: boolean; error?: { message?: string } } | null = null;
      try {
        json = (await response.json()) as { success?: boolean; error?: { message?: string } };
      } catch {
        json = null;
      }
      if (!response.ok || !json?.success) {
        setActionError(json?.error?.message ?? "Could not issue the invoice. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setActionError("Could not reach the app. Check that it is running and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/invoices/${invoiceId}/pdf`}
          download
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
        >
          Download PDF
        </a>

        {isDraft && (
          <>
            <Link
              href={`/invoices/${invoiceId}/edit`}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              Edit draft
            </Link>
            <button
              type="button"
              onClick={handleIssue}
              disabled={pending}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {pending ? "Issuing..." : "Issue invoice"}
            </button>
          </>
        )}

        {canRecordPayment && !showPayment && (
          <button
            type="button"
            onClick={() => setShowPayment(true)}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Record payment
          </button>
        )}
      </div>

      {isIssued && <p className="text-sm text-gray-600">Issued invoices are locked. Record payments instead.</p>}

      {actionError && (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
      )}

      {canRecordPayment && showPayment && (
        <PaymentForm
          invoiceId={invoiceId}
          outstandingPaise={outstandingPaise}
          defaultDate={defaultDate}
          onClose={() => setShowPayment(false)}
        />
      )}

      {isIssued && <ReminderPanel invoiceId={invoiceId} outstandingPaise={outstandingPaise} />}
    </div>
  );
}
