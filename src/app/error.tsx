"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-semibold text-red-900">CashPilot could not load this page</h1>
        <p className="mt-2 text-sm text-red-800">
          Your saved records were not changed. Check that the local database is available, then try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
