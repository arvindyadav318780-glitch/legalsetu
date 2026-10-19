import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { REQUEST_STATUSES, statusLabel } from "@/lib/status";
import { STATES as INDIA_STATES } from "@/lib/india";
import { DashHeader, fmtDate } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { isOverdue, daysSince, isTestRecord } from "@/lib/crm";
import { selectCls } from "@/components/site/LocationSelect";

export const Route = createFileRoute("/_authenticated/admin/requests")({ component: AdminRequests });

function AdminRequests() {
  const [status, setStatus] = useState("");
  const [assign, setAssign] = useState("");
  const [state, setState] = useState("");
  const [svc, setSvc] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [q, setQ] = useState("");
  const { data: od = 3 } = useQuery({ queryKey: ["crm-overdue-days"], queryFn: async () => (await supabase.rpc("crm_overdue_days")).data ?? 3 });
  const { data = [] } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => (await supabase.from("service_requests").select("id,reference,service_name,status,contact_name,state,created_at,updated_at,assigned_professional_id,assignment_accepted_at").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const services = [...new Set(data.map((r) => r.service_name))].sort();
  const list = data.filter((r) => (!svc || r.service_name === svc) && (!overdueOnly || isOverdue(r.status, r.updated_at, od)) && (!q || (r.reference + " " + r.contact_name).toLowerCase().includes(q.toLowerCase())) && (!status || r.status === status) && (!state || r.state === state)
    && (!assign || (assign === "unassigned" ? !r.assigned_professional_id : assign === "awaiting" ? !!r.assigned_professional_id && !r.assignment_accepted_at : !!r.assigned_professional_id)));
  return (
    <>
      <DashHeader title="Request management" subtitle="Open a request to assign a verified professional or update its status. Every change is recorded in the audit log." />
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Filter by status" className={selectCls + " w-52"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{REQUEST_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
        <select aria-label="Filter by assignment" className={selectCls + " w-44"} value={assign} onChange={(e) => setAssign(e.target.value)}><option value="">Any assignment</option><option value="unassigned">Unassigned</option><option value="awaiting">Awaiting acceptance</option><option value="assigned">Assigned</option></select>
        <select aria-label="Filter by state" className={selectCls + " w-52"} value={state} onChange={(e) => setState(e.target.value)}><option value="">All states</option>{INDIA_STATES.map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filter by service" className={selectCls + " w-52"} value={svc} onChange={(e) => setSvc(e.target.value)}><option value="">All services</option>{services.map((s) => <option key={s}>{s}</option>)}</select>
        <input aria-label="Search reference or client" placeholder="Search reference or client" className={selectCls + " w-56"} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />Overdue only ({od}+ days)</label>
      </div>
      {list.length === 0 ? <EmptyState title="No requests match" /> : (
        <div className="card-surface divide-y">{list.map((r) => (
          <Link key={r.id} to="/dashboard/requests/$id" params={{ id: r.id }} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40">
            <div className="min-w-0 flex-1"><p className="font-medium">{r.service_name} · {r.contact_name}</p><p className="text-xs text-muted-foreground">{r.reference} · {r.state ?? "—"} · {fmtDate(r.created_at)} · last update {daysSince(r.updated_at)}d ago · {r.assigned_professional_id ? (r.assignment_accepted_at ? "Accepted" : "Awaiting acceptance") : "Unassigned"}</p></div>
            {isTestRecord(r.reference, r.contact_name) && <span className="rounded bg-muted px-1.5 text-xs font-semibold">TEST</span>}{isOverdue(r.status, r.updated_at, od) && <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Overdue</span>}<StatusPill status={r.status} />
          </Link>
        ))}</div>
      )}
    </>
  );
}
