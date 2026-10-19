import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { fmtDate, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { isTestRecord } from "@/lib/crm";

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-semibold">{title}{count != null && <span className="ml-2 text-sm font-normal text-muted-foreground">({count})</span>}</h2>
      <div className="card-surface divide-y">{children}</div>
    </section>
  );
}
export const Empty = ({ text = "None recorded." }: { text?: string }) => <p className="p-4 text-sm text-muted-foreground">{text}</p>;
export const TestTag = ({ on }: { on: boolean }) => (on ? <span className="ml-1 rounded bg-muted px-1.5 text-xs font-semibold">TEST</span> : null);
export const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">{children}</div>;
export const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 break-words text-sm font-medium">{value ?? "—"}</p></div>
);

export type ReqRow = { id: string; reference: string; service_name: string; status: string; created_at: string; updated_at: string; overdue: boolean; accepted_at: string | null };
export function RequestRow({ r, who }: { r: ReqRow; who: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className="min-w-0 flex-1">
        <Link to="/dashboard/requests/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.reference}</Link> · {r.service_name}<TestTag on={isTestRecord(r.reference)} />
        <p className="text-xs text-muted-foreground">{who} · created {fmtDate(r.created_at)} · last update {fmtDateTime(r.updated_at)}</p>
      </div>
      {r.overdue && <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Overdue</span>}
      <StatusPill status={r.status} />
    </div>
  );
}

export type TimelineItem = { at: string; label: string; to?: { id: string } };
export function Timeline({ items }: { items: TimelineItem[] }) {
  const sorted = [...items].filter((i) => i.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
  return (
    <Section title="Activity timeline" count={sorted.length}>
      {sorted.length === 0 ? <Empty text="No recorded activity." /> : sorted.map((i, n) => (
        <div key={n} className="flex justify-between gap-3 p-3 text-sm">
          <span>{i.to ? <Link to="/dashboard/requests/$id" params={{ id: i.to.id }} className="hover:underline">{i.label}</Link> : i.label}</span>
          <span className="shrink-0 text-muted-foreground">{fmtDateTime(i.at)}</span>
        </div>
      ))}
    </Section>
  );
}

export const DeniedOrMissing = ({ missing }: { missing?: boolean }) => (
  <EmptyState title={missing ? "Record not found" : "Administrators only"} body={missing ? "No record exists with this ID." : "This detail view is restricted to administrators."} />
);

export function Pager({ page, pages, set }: { page: number; pages: number; set: (n: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm">
      <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => set(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page >= pages} onClick={() => set(page + 1)}>Next</button>
    </div>
  );
}
