import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">Record not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          The requested CashPilot record does not exist or is no longer available.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
