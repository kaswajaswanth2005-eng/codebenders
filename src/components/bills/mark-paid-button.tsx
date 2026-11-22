"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { todayKolkata } from "@/lib/financial/dates";
import { formatINR } from "@/lib/financial/money";

interface MarkPaidButtonProps {
  billId: string;
  dueDate: string;
  amountPaise: number;
}

interface ApiResponse {
  success: boolean;
  error?: { code: string; message: string };
}

export function MarkPaidButton({ billId, dueDate, amountPaise }: MarkPaidButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      `Mark ${formatINR(amountPaise)} as paid for the bill due ${dueDate}?`,
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/bills/${encodeURIComponent(billId)}/occurrences/${encodeURIComponent(dueDate)}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueDate,
            paidDate: todayKolkata(),
            amountRupees: amountPaise / 100,
          }),
        },
      );

      let json: ApiResponse | null = null;
      try {
        json = (await response.json()) as ApiResponse;
      } catch {
        json = null;
      }

      if (!response.ok || !json?.success) {
        setError(json?.error?.message ?? "The bill could not be marked paid. Please try again.");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach the app. Check that it is running and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Mark paid"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
