import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/bills", label: "Expenses", icon: Receipt },
  { href: "/forecast", label: "Cash Forecast", icon: TrendingUp },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-slate-900 shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>

      <aside className="border-b border-slate-200/80 bg-white/95 px-3 py-3 backdrop-blur md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-b-0 md:border-r md:px-4 md:py-5">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-violet-200">
            CP
          </div>
          <div>
            <Link href="/dashboard" className="block text-base font-bold tracking-tight text-slate-950">
              CashPilot
            </Link>
            <p className="text-xs font-medium text-slate-400">AI finance workspace</p>
          </div>
        </div>

        <nav aria-label="Primary" className="mt-3 flex gap-1 overflow-x-auto md:mt-8 md:flex-col md:overflow-visible">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-gradient-to-r hover:from-indigo-50 hover:to-cyan-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-sm">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:absolute md:bottom-5 md:left-4 md:right-4">
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-indigo-50 via-violet-50 to-emerald-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
              <Sparkles className="h-4 w-4" /> CashPilot AI
            </div>
            <p className="mt-2 text-xs leading-5 text-indigo-900/70">Review your cash position and upcoming actions.</p>
          </div>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
