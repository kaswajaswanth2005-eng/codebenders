"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";

type Mode = "create" | "edit";

interface FormValues {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  openingCashRupees: string;
  openingCashDate: string;
  paymentInstructions: string;
}

type FieldName = keyof FormValues;

export type BusinessFormInitial = Partial<FormValues>;

interface BusinessFormProps {
  mode: Mode;
  initial?: BusinessFormInitial;
}

interface ApiResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
    fields?: Partial<Record<FieldName, string[]>>;
  };
}

const EMPTY_VALUES: FormValues = {
  businessName: "",
  ownerName: "",
  email: "",
  phone: "",
  address: "",
  openingCashRupees: "",
  openingCashDate: "",
  paymentInstructions: "",
};

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
const labelClass = "block text-sm font-medium text-gray-800";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null;
  }
  return <p className="mt-1 text-sm text-red-600">{messages[0]}</p>;
}

export function BusinessForm({ mode, initial }: BusinessFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ ...EMPTY_VALUES, ...initial });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string[]>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  function update(name: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function inputProps(name: FieldName) {
    return {
      id: name,
      name,
      value: values[name],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        update(name, event.target.value),
      "aria-invalid": fieldErrors[name] && fieldErrors[name]!.length > 0 ? true : undefined,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});
    setSuccess(false);

    try {
      const response = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
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
        setFormError(json?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      if (mode === "create") {
        setTimeout(() => router.push("/dashboard"), 800);
      } else {
        router.refresh();
      }
    } catch {
      setFormError("Could not reach the app. Check that it is running and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {mode === "edit" && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Changing the opening balance or its date changes every cash forecast.
        </div>
      )}

      <div>
        <label htmlFor="businessName" className={labelClass}>
          Business name *
        </label>
        <input type="text" className={inputClass} {...inputProps("businessName")} />
        <FieldError messages={fieldErrors.businessName} />
      </div>

      <div>
        <label htmlFor="ownerName" className={labelClass}>
          Owner name *
        </label>
        <input type="text" className={inputClass} {...inputProps("ownerName")} />
        <FieldError messages={fieldErrors.ownerName} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Business email
        </label>
        <input type="email" className={inputClass} {...inputProps("email")} />
        <FieldError messages={fieldErrors.email} />
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
          Business phone
        </label>
        <input type="tel" className={inputClass} {...inputProps("phone")} />
        <FieldError messages={fieldErrors.phone} />
      </div>

      <div>
        <label htmlFor="address" className={labelClass}>
          Business address
        </label>
        <textarea rows={2} className={inputClass} {...inputProps("address")} />
        <FieldError messages={fieldErrors.address} />
      </div>

      <div>
        <label htmlFor="openingCashRupees" className={labelClass}>
          Opening cash balance in ₹ *
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          className={inputClass}
          {...inputProps("openingCashRupees")}
        />
        <FieldError messages={fieldErrors.openingCashRupees} />
      </div>

      <div>
        <label htmlFor="openingCashDate" className={labelClass}>
          As of date *
        </label>
        <input type="date" className={inputClass} {...inputProps("openingCashDate")} />
        <FieldError messages={fieldErrors.openingCashDate} />
      </div>

      <div>
        <label htmlFor="paymentInstructions" className={labelClass}>
          Payment instructions
        </label>
        <textarea
          rows={3}
          placeholder="e.g. UPI: studio@bank, Bank: ... "
          className={inputClass}
          {...inputProps("paymentInstructions")}
        />
        <FieldError messages={fieldErrors.paymentInstructions} />
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm font-medium text-green-700">
          Business details saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save business details"}
      </button>
    </form>
  );
}
