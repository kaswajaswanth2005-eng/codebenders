"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ArchiveBillButtonProps {
  billId: string;
}

interface ApiResponse {
  success: boolean;
  error?: { code: string; message: string };
}

export function ArchiveBillButton({ billId }: ArchiveBillButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      "Archive this bill? Future occurrences will stop. Paid history is kept.",
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/archive`, {
        method: "POST",
      });

      let json: ApiResponse | null = null;
      try {
        json = (await response.json()) as ApiResponse;
      } catch {
        json = null;
      }

      if (!response.ok || !json?.success) {
        setError(json?.error?.message ?? "The bill could not be archived. Please try again.");
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
      <p className="text-sm text-gray-600">
        Archiving stops future occurrences. Paid history is kept.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="mt-3 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "Archiving..." : "Archive bill"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
