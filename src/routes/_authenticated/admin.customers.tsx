import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pager, TestTag } from "@/components/dash/CrmBits";
import { isTestRecord } from "@/lib/crm";
import { selectCls } from "@/components/site/LocationSelect";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === "string" ? { q: s.q.slice(0, 100) } : {}),
  component: Customers,
});

function Customers() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState(Route.useSearch().q ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [sort, setSort] = useState("new");
  const [stat, setStat] = useState("");
  const [page, setPage] = useState(1);
  const { data = [] } = useQuery({
    queryKey: ["admin-customers", isAdmin],
    queryFn: async () => {
      // Staff directory: email only returned to admins; phone never returned. Enforced in the database.
      const { data: rows } = await supabase.rpc("staff_directory");
      return (rows ?? []).filter((x) => x.is_customer && (isAdmin || x.id !== user?.id));
    },
  });
  const detail = useQuery({
    queryKey: ["admin-customer", open], enabled: !!open,
    queryFn: async () => {
      const [r, t] = await Promise.all([
        supabase.from("service_requests").select("id,reference,service_name,status,created_at").eq("customer_id", open!).order("created_at", { ascending: false }),
        supabase.from("support_tickets").select("id,subject,kind,status,created_at").eq("user_id", open!).order("created_at", { ascending: false }),
      ]);
      return { requests: r.data ?? [], tickets: t.data ?? [] };
    },
  });
  const setSuspended = async (id: string, suspended: boolean) => {
    if (suspended && reason.trim().length < 5) return toast.error("Enter a reason (at least 5 characters)");
    const { error } = await supabase.from("profiles").update({ suspended, suspended_reason: suspended ? reason.trim().slice(0, 300) : null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(suspended ? "Account suspended" : "Account reactivated"); setReason("");
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };
  const all = data.filter((u) => `${u.full_name ?? ""} ${u.email ?? ""} ${u.id}`.toLowerCase().includes(q.toLowerCase()) && (!stat || (stat === "suspended" ? u.suspended : stat === "test" ? isTestRecord(u.full_name, u.email) : !u.suspended)))
    .sort((a, b) => sort === "name" ? (a.full_name ?? "").localeCompare(b.full_name ?? "") : sort === "old" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
  const pages = Math.max(1, Math.ceil(all.length / 20)); const pg = Math.min(page, pages);
  const list = all.slice((pg - 1) * 20, pg * 20);
  return (
    <>
      <DashHeader title="Customers" subtitle="Search customers, review their requests and tickets, and suspend accounts when necessary. Profile details can only be changed by the customer." />
      <Input className="mb-4 max-w-sm" placeholder={isAdmin ? "Search by name, email or ID" : "Search by name or ID"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Filter by status" className={selectCls + " w-44"} value={stat} onChange={(e) => { setStat(e.target.value); setPage(1); }}><option value="">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="test">TEST accounts</option></select>
        <select aria-label="Sort" className={selectCls + " w-44"} value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">Newest first</option><option value="old">Oldest first</option><option value="name">Name A–Z</option></select>
        <span className="self-center text-sm text-muted-foreground">{all.length} customer(s)</span>
      </div>
      {list.length === 0 ? <EmptyState title="No customers found" /> : (
        <div className="card-surface divide-y">{list.map((u) => (
          <div key={u.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1"><p className="font-medium">{isAdmin ? <Link to="/admin/customers/$id" params={{ id: u.id }} className="hover:underline">{u.full_name || "Unnamed user"}</Link> : (u.full_name || "Unnamed user")}<TestTag on={isTestRecord(u.full_name, u.email)} /> {u.suspended && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Suspended</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{isAdmin ? `${u.email ?? "—"} · ` : ""}{[u.city, u.state].filter(Boolean).join(", ") || "No location"} · joined {fmtDate(u.created_at)}</p></div>
              {isAdmin && <Button asChild size="sm"><Link to="/admin/customers/$id" params={{ id: u.id }}>Open record</Link></Button>}
              <Button size="sm" variant="outline" onClick={() => setOpen(open === u.id ? null : u.id)}>{open === u.id ? "Hide" : "View"}</Button>
            </div>
            {open === u.id && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requests</p>
                  {(detail.data?.requests ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None</p> : detail.data!.requests.map((r) => (
                    <Link key={r.id} to="/dashboard/requests/$id" params={{ id: r.id }} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0 hover:text-accent"><span>{r.reference} · {r.service_name}</span><StatusPill status={r.status} /></Link>
                  ))}</div>
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tickets</p>
                  {(detail.data?.tickets ?? []).length === 0 ? <p className="text-sm text-muted-foreground">None</p> : detail.data!.tickets.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0"><span>{t.subject} · {t.kind.replace("_", " ")}</span><StatusPill status={t.status} /></div>
                  ))}</div>
                {isAdmin && u.id !== user?.id && (
                  <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                    {u.suspended ? (
                      <><span className="text-sm text-muted-foreground">Reason: {u.suspended_reason}</span><Button size="sm" variant="outline" onClick={() => setSuspended(u.id, false)}>Reactivate</Button></>
                    ) : (
                      <><Input className="max-w-sm" placeholder="Reason for suspension" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Suspension reason" /><Button size="sm" variant="destructive" onClick={() => setSuspended(u.id, true)}>Suspend</Button></>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}</div>
      )}
      <Pager page={pg} pages={pages} set={setPage} />
    </>
  );
}
