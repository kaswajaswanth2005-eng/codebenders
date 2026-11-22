"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
] as const;

interface PaymentFormProps {
  invoiceId: string;
  outstandingPaise: number;
  defaultDate: string;
  onClose: () => void;
}

type FieldErrors = Partial<Record<string, string[]>>;

interface ApiResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
    fields?: FieldErrors;
  };
}

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
const labelClass = "block text-sm font-medium text-gray-800";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}

export function PaymentForm({ invoiceId, outstandingPaise, defaultDate, onClose }: PaymentFormProps) {
  const router = useRouter();
  const [amountRupees, setAmountRupees] = useState((outstandingPaise / 100).toFixed(2));
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [method, setMethod] = useState<string>("UPI");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRupees: Number(amountRupees),
          paymentDate,
          method,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotencyKey,
        }),
      });

      let json: ApiResponse | null = null;
      try {
        json = (await response.json()) as ApiResponse;
      } catch {
        json = null;
      }

      if (!response.ok || !json?.success) {
        if (json?.error?.fields) {
          setFieldErrors(json.error.fields);
        }
        setFormError(json?.error?.message ?? "Could not record the payment. Please try again.");
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setFormError("Could not reach the app. Check that it is running and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
      <div>
        <label htmlFor="payment-amount" className={labelClass}>
          Amount in ₹ *
        </label>
        <input
          id="payment-amount"
          name="amountRupees"
          type="number"
          step="0.01"
          min="0.01"
          max={(outstandingPaise / 100).toFixed(2)}
          inputMode="decimal"
          value={amountRupees}
          onChange={(event) => setAmountRupees(event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.amountRupees} />
      </div>

      <div>
        <label htmlFor="payment-date" className={labelClass}>
          Payment date *
        </label>
        <input
          id="payment-date"
          name="paymentDate"
          type="date"
          value={paymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.paymentDate} />
      </div>

      <div>
        <label htmlFor="payment-method" className={labelClass}>
          Method *
        </label>
        <select
          id="payment-method"
          name="method"
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className={inputClass}
        >
          {METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError messages={fieldErrors.method} />
      </div>

      <div>
        <label htmlFor="payment-reference" className={labelClass}>
          Reference
        </label>
        <input
          id="payment-reference"
          name="referenceNumber"
          type="text"
          value={referenceNumber}
          onChange={(event) => setReferenceNumber(event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.referenceNumber} />
      </div>

      <div>
        <label htmlFor="payment-notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="payment-notes"
          name="notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={inputClass}
        />
        <FieldError messages={fieldErrors.notes} />
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {pending ? "Recording..." : "Record payment"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
