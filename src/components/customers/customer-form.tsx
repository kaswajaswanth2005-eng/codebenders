"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

type Mode = "create" | "edit";

interface FormValues {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

type FieldName = keyof FormValues;

export type CustomerFormInitial = Partial<FormValues>;

interface CustomerFormProps {
  mode: Mode;
  customerId?: string;
  initial?: CustomerFormInitial;
}

interface ApiResponse {
  success: boolean;
  data?: { id: string };
  error?: {
    code: string;
    message: string;
    fields?: Partial<Record<FieldName, string[]>>;
  };
}

const EMPTY_VALUES: FormValues = {
  name: "",
  companyName: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
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

export function CustomerForm({ mode, customerId, initial }: CustomerFormProps) {
  const [values, setValues] = useState<FormValues>({ ...EMPTY_VALUES, ...initial });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string[]>>>({});
  const [formError, setFormError] = useState<string | null>(null);
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

    const url = mode === "create" ? "/api/customers" : `/api/customers/${customerId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    try {
      const response = await fetch(url, {
        method,
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

      const id = mode === "create" ? json.data?.id : customerId;
      if (!id) {
        setFormError("Saved, but the customer could not be opened. Check the customers list.");
        return;
      }
      window.location.assign(`/customers/${id}`);
    } catch {
      setFormError("Could not reach the app. Check that it is running and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="name" className={labelClass}>
          Customer name *
        </label>
        <input type="text" className={inputClass} {...inputProps("name")} />
        <FieldError messages={fieldErrors.name} />
      </div>

      <div>
        <label htmlFor="companyName" className={labelClass}>
          Company
        </label>
        <input type="text" className={inputClass} {...inputProps("companyName")} />
        <FieldError messages={fieldErrors.companyName} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input type="email" className={inputClass} {...inputProps("email")} />
        <FieldError messages={fieldErrors.email} />
      </div>

      <div>
        <label htmlFor="phone" className={labelClass}>
          Phone
        </label>
        <input type="tel" className={inputClass} {...inputProps("phone")} />
        <FieldError messages={fieldErrors.phone} />
      </div>

      <div>
        <label htmlFor="address" className={labelClass}>
          Address
        </label>
        <textarea rows={2} className={inputClass} {...inputProps("address")} />
        <FieldError messages={fieldErrors.address} />
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea rows={3} className={inputClass} {...inputProps("notes")} />
        <FieldError messages={fieldErrors.notes} />
      </div>

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {pending ? "Saving..." : mode === "create" ? "Create customer" : "Save changes"}
      </button>
    </form>
  );
}
