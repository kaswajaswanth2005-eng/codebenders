"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import type { ForecastResult } from "@/lib/financial/forecast";
import { formatINR } from "@/lib/financial/money";
import { formatDisplayDate } from "@/components/forecast/format";
import { ForecastChart } from "@/components/forecast/forecast-chart";

export type SimulatorInvoice = {
  id: string;
  label: string;
  outstandingPaise: number;
  expectedDate: string | null;
};

export type SimulationResult = {
  baseline: ForecastResult;
  scenario: ForecastResult;
  invoiceId: string;
  originalDate: string | null;
  scenarioDate: string | null;
  differenceAtHorizonPaise: number;
};

interface SimulatorProps {
  invoices: SimulatorInvoice[];
  horizonDays: number;
}

interface SimulateResponse {
  success: boolean;
  data?: SimulationResult;
  error?: { code: string; message: string };
}

const DELAY_PRESETS = [7, 15, 30] as const;

const inputClass =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
const labelClass = "block text-sm font-medium text-gray-800";

function buttonClass(active: boolean): string {
  return `rounded-md border px-3 py-2 text-sm font-medium ${
    active
      ? "border-gray-900 bg-gray-900 text-white"
      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100"
  }`;
}

function displayOrPlaceholder(isoDate: string | null, placeholder: string): string {
  return isoDate === null ? placeholder : formatDisplayDate(isoDate);
}

function signedINR(paise: number): string {
  return paise > 0 ? `+${formatINR(paise)}` : formatINR(paise);
}

export function Simulator({ invoices, horizonDays }: SimulatorProps) {
  const [invoiceId, setInvoiceId] = useState("");
  const [preset, setPreset] = useState<number | null>(null);
  const [customDelay, setCustomDelay] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [resultLabel, setResultLabel] = useState("");

  /** Preset buttons win; otherwise the custom input must be a whole number 1-365. */
  function resolveDelay(): number | null {
    if (preset !== null) return preset;
    const trimmed = customDelay.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const value = Number(trimmed);
    return value >= 1 && value <= 365 ? value : null;
  }

  const delayDays = resolveDelay();
  const customInvalid = preset === null && customDelay.trim() !== "" && delayDays === null;

  function handlePreset(days: number) {
    setPreset(days);
    setCustomDelay("");
  }

  function handleCustomChange(event: ChangeEvent<HTMLInputElement>) {
    setCustomDelay(event.target.value);
    setPreset(null);
  }

  function handleReset() {
    setInvoiceId("");
    setPreset(null);
    setCustomDelay("");
    setError(null);
    setResult(null);
    setResultLabel("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceId || delayDays === null) return;

    setPending(true);
    setError(null);
    setResult(null);
    setResultLabel(invoices.find((invoice) => invoice.id === invoiceId)?.label ?? "");

    try {
      const response = await fetch("/api/forecast/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, delayDays, horizonDays }),
      });

      let json: SimulateResponse | null = null;
      try {
        json = (await response.json()) as SimulateResponse;
      } catch {
        json = null;
      }

      if (!response.ok || !json?.success || !json.data) {
        setError(json?.error?.message ?? "The simulation could not be run. Please try again.");
        return;
      }

      setResult(json.data);
    } catch {
      setError("Could not reach the app. Check that it is running and try again.");
    } finally {
      setPending(false);
    }
  }


  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label htmlFor="simulate-invoice" className={labelClass}>
            Invoice
          </label>
          <select
            id="simulate-invoice"
            name="invoiceId"
            required
            value={invoiceId}
            onChange={(event) => setInvoiceId(event.target.value)}
            className={inputClass}
          >
            <option value="">Select an issued invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {`${invoice.label} — ${formatINR(invoice.outstandingPaise)} outstanding${
                  invoice.expectedDate
                    ? `, expected ${formatDisplayDate(invoice.expectedDate)}`
                    : ", no expected date"
                }`}
              </option>
            ))}
          </select>
          {invoices.length === 0 ? (
            <p className="mt-1 text-sm text-gray-600">No issued invoices have money outstanding.</p>
          ) : null}
        </div>

        <fieldset>
          <legend className={labelClass}>Delay</legend>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            {DELAY_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={preset === days}
                onClick={() => handlePreset(days)}
                className={buttonClass(preset === days)}
              >
                {days} days
              </button>
            ))}
            <div>
              <label htmlFor="custom-delay" className="block text-xs font-medium text-gray-700">
                Custom days (1–365)
              </label>
              <input
                id="custom-delay"
                name="customDelay"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                step={1}
                value={customDelay}
                onChange={handleCustomChange}
                aria-invalid={customInvalid ? true : undefined}
                aria-describedby={customInvalid ? "custom-delay-error" : undefined}
                className="mt-1 w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>
          {customInvalid ? (
            <p id="custom-delay-error" className="mt-1 text-sm text-red-600">
              Enter a whole number from 1 to 365.
            </p>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending || !invoiceId || delayDays === null}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Running…" : "Run simulation"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
          >
            Reset
          </button>
        </div>

        <p className="text-sm text-gray-600">This simulation does not change any invoice or payment.</p>
      </form>

      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <SimulationOutcome result={result} horizonDays={horizonDays} invoiceLabel={resultLabel} />
      ) : null}
    </div>
  );
}

function SimulationOutcome({
  result,
  horizonDays,
  invoiceLabel,
}: {
  result: SimulationResult;
  horizonDays: number;
  invoiceLabel: string;
}) {
  const { baseline, scenario } = result;
  const windowLabel = `${horizonDays} days`;

  const shortfallSentence = scenario.firstShortfallDate
    ? `With this delay, cash goes below zero on ${formatDisplayDate(scenario.firstShortfallDate)} (lowest ${formatINR(scenario.minimumCashPaise)}).`
    : `With this delay, cash stays at or above zero within ${windowLabel} (lowest ${formatINR(scenario.minimumCashPaise)}).`;
  const baselineSentence = baseline.firstShortfallDate
    ? `Without the delay, cash goes below zero on ${formatDisplayDate(baseline.firstShortfallDate)}.`
    : `Without the delay, cash does not go below zero within ${windowLabel}.`;

  return (
    <section aria-labelledby="simulation-result" className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 id="simulation-result" className="text-lg font-semibold text-gray-900">
        Simulation result{invoiceLabel ? `: ${invoiceLabel}` : ""}
      </h2>

      <p className="text-sm text-gray-800">
        {shortfallSentence} {baselineSentence}
      </p>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-700">Expected collection date</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {displayOrPlaceholder(result.originalDate, "Outside this window")} →{" "}
            {displayOrPlaceholder(result.scenarioDate, "Outside this window")}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-700">Difference at day {horizonDays}</dt>
          <dd className="mt-1 text-sm text-gray-900">{signedINR(result.differenceAtHorizonPaise)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-700">Lowest projected cash</dt>
          <dd className="mt-1 text-sm text-gray-900">
            Before: {formatINR(baseline.minimumCashPaise)} on {formatDisplayDate(baseline.minimumCashDate)}
            <br />
            After: {formatINR(scenario.minimumCashPaise)} on {formatDisplayDate(scenario.minimumCashDate)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-700">First shortfall</dt>
          <dd className="mt-1 text-sm text-gray-900">
            Before: {displayOrPlaceholder(baseline.firstShortfallDate, "None")}
            <br />
            After: {displayOrPlaceholder(scenario.firstShortfallDate, "None")}
          </dd>
        </div>
      </dl>

      <ForecastChart
        points={scenario.points}
        baselinePoints={baseline.points}
        horizonDays={horizonDays}
        primaryLabel="Shifted scenario"
      />
    </section>
  );
}
