"use client";

import { useEffect, useState } from "react";

interface ReminderPanelProps {
  invoiceId: string;
  outstandingPaise: number;
}

interface ReminderResponse {
  success?: boolean;
  text?: string | null;
  data?: { text?: string | null };
  error?: { message?: string };
}

export function ReminderPanel({ invoiceId, outstandingPaise }: ReminderPanelProps) {
  const [text, setText] = useState("");
  const [hasText, setHasText] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/reminder`);
        const json = (await response.json()) as ReminderResponse;
        if (cancelled) return;
        if (!response.ok) {
          setLoadError(json.error?.message ?? "Could not load the reminder draft.");
          return;
        }
        const reminderText = json.data?.text ?? json.text ?? null;
        setHasText(reminderText !== null);
        setText(reminderText ?? "");
      } catch {
        if (!cancelled) {
          setLoadError("Could not load the reminder draft. Check that the app is running.");
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, outstandingPaise]);

  async function handleCopy() {
    setCopyMessage(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied to clipboard.");
    } catch {
      setCopyMessage("Could not copy automatically. Select the text and copy it manually.");
    }
  }

  return (
    <section id="payment-reminder" className="scroll-mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Payment reminder</h2>

      {!loaded && <p className="mt-2 text-sm text-gray-600">Loading reminder...</p>}

      {loaded && loadError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {loadError}
        </p>
      )}

      {loaded && !loadError && !hasText && (
        <p className="mt-2 text-sm text-gray-600">Nothing is outstanding on this invoice.</p>
      )}

      {loaded && !loadError && hasText && (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-gray-600">
            This is a draft you can copy. CashPilot does not send it.
          </p>
          <label htmlFor="reminder-text" className="sr-only">
            Reminder text
          </label>
          <textarea
            id="reminder-text"
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              Copy
            </button>
            {copyMessage && (
              <p role="status" className="text-sm text-gray-700">
                {copyMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
