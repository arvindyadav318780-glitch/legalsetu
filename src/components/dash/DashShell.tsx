import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type DashNavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

export function DashShell({ title, nav, children }: { title: string; nav: DashNavItem[]; children: ReactNode }) {
  return (
    <div className="container-page grid grid-cols-1 gap-6 py-8 lg:grid-cols-[230px_1fr]">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
        <p className="eyebrow mb-3 hidden lg:block">{title}</p>
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:overflow-visible" aria-label={title}>
          {nav.map((n) => (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <Link key={n.to} to={n.to as any} activeOptions={{ exact: n.exact }}
              className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
              activeProps={{ className: "bg-card text-foreground shadow-sm ring-1 ring-border" }}>
              <n.icon className="h-4 w-4" />{n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DashHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div><h1 className="text-2xl font-bold md:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}</div>
      {action}
    </div>
  );
}

export function Stat({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: LucideIcon }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-accent" /></div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

export const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (d: string) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
