import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Briefcase, BadgeCheck, ClipboardList, AlertTriangle, LifeBuoy, UserX, Clock, Scale, Mail, ShieldAlert, EyeOff, Ban, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashHeader, Stat, fmtDateTime } from "@/components/dash/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { statusLabel } from "@/lib/status";
import { inr, summarise, type FinRow } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

type Dash = Record<string, number> & { requests_by_status: Record<string, number> };
const ALERT_LABEL: Record<string, string> = { crm_overdue_request: "Request overdue", crm_possible_duplicate: "Possible duplicate request", crm_payment_mismatch: "Payment record needs reconciliation", message_burst: "Unusual message activity" };

function AdminHome() {
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["crm-dashboard"],
    queryFn: async () => {
      await supabase.rpc("crm_refresh_alerts"); // dedup enforced in the database
      const [d, f, alerts, logs] = await Promise.all([
        supabase.rpc("crm_dashboard"),
        supabase.rpc("crm_finance_summary"),
        supabase.from("risk_alerts").select("*").in("status", ["open", "reviewing"]).order("created_at", { ascending: false }).limit(50),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(8),
      ]);
      if (d.error) throw d.error;
      const fin = f.data as unknown as { payments: FinRow[]; orders: FinRow[] } | null;
      return { d: d.data as unknown as Dash, fin: summarise([...(fin?.payments ?? []), ...(fin?.orders ?? [])]), alerts: alerts.data ?? [], logs: logs.data ?? [] };
    },
  });
  const [days, setDays] = useState("");
  if (error) return <DashHeader title="Admin overview" subtitle="The control center is available to administrators only." />;
  const d = data?.d; const v = (k: string) => (d ? d[k] : "—");
  const rs = d?.requests_by_status ?? {};
  const actions = [
    { n: d?.overdue, label: `Requests with no update for ${d?.overdue_days ?? 3}+ days`, to: "/admin/requests" },
    { n: d?.unassigned, label: "Requests without a professional", to: "/admin/requests" },
    { n: d?.ver_pending, label: "Verifications to review", to: "/admin/verification" },
    { n: d?.open_complaints, label: "Open complaints", to: "/admin/complaints" },
    { n: d?.open_reports, label: "Open reports", to: "/admin/trust" },
    { n: d?.open_appeals, label: "Appeals awaiting decision", to: "/admin/trust" },
    { n: d?.pending_contact, label: "Contact form messages awaiting reply", to: "/admin/tickets" },
    { n: data?.fin.reconcile, label: "Payment records to reconcile", to: "/admin/finance" },
  ].filter((a) => (a.n ?? 0) > 0);
  const ack = async (id: string) => {
    const note = window.prompt("Acknowledgement note (optional)") ?? "";
    const { error } = await supabase.rpc("crm_ack_alert", { _id: id, _note: note });
    if (error) toast.error("Could not acknowledge"); else { toast.success("Acknowledged"); qc.invalidateQueries({ queryKey: ["crm-dashboard"] }); }
  };
  const saveDays = async () => {
    const { error } = await supabase.rpc("crm_set_overdue_days", { _days: Number(days) });
    if (error) toast.error(error.message); else { toast.success("Threshold saved"); setDays(""); qc.invalidateQueries({ queryKey: ["crm-dashboard"] }); }
  };
  return (
    <>
      <DashHeader title="Control center" subtitle="Live figures from LegalSetu records. Nothing on this page charges, approves or suspends anyone." />
      {d && d.requests_test > 0 && <p className="mb-4 rounded-lg border bg-card p-3 text-sm"><strong>{d.requests_test} of {d.requests_total}</strong> requests are TEST records and are included in the counts below.</p>}

      <section className="card-surface mb-6 p-5">
        <h2 className="mb-1 font-semibold">Today's summary</h2>
        <p className="text-sm text-muted-foreground">{d ? `${v("requests_total")} requests (${v("unassigned")} unassigned, ${v("overdue")} overdue) · ${v("ver_pending")} verifications pending · ${Number(d.open_complaints) + Number(d.open_reports) + Number(d.open_appeals)} trust & safety items open · ${v("pending_contact")} contact messages waiting · ${inr(data!.fin.collected)} verified collections to date.` : "Loading…"}</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 font-semibold">Action required</h2>
        <div className="card-surface divide-y">
          {!d && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {d && actions.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing needs your attention right now.</p>}
          {actions.map((a) => <Link key={a.label} to={a.to as never} className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-muted/40"><span>{a.label}</span><span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-semibold">{a.n}</span></Link>)}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered clients" value={v("clients")} icon={Users} />
        <Stat label="CAs" value={v("pros_ca")} icon={Briefcase} />
        <Stat label="Advocates" value={v("pros_advocate")} icon={Scale} />
        <Stat label="Verification pending" value={v("ver_pending")} icon={BadgeCheck} />
        <Stat label="Approved professionals" value={v("ver_approved")} icon={BadgeCheck} />
        <Stat label="Unlisted professionals" value={v("unlisted")} icon={EyeOff} />
        <Stat label="Restricted / suspended" value={v("restricted")} icon={Ban} />
        <Stat label="Unassigned requests" value={v("unassigned")} icon={UserX} />
        <Stat label="Overdue requests" value={v("overdue")} icon={Clock} />
        <Stat label="Open complaints" value={v("open_complaints")} icon={AlertTriangle} />
        <Stat label="Unresolved appeals" value={v("open_appeals")} icon={ShieldAlert} />
        <Stat label="Contact messages pending" value={v("pending_contact")} icon={Mail} />
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Requests by status</h2>
      <div className="card-surface flex flex-wrap gap-2 p-4 text-sm">
        {Object.keys(rs).length === 0 && <span className="text-muted-foreground">No requests yet.</span>}
        {Object.entries(rs).map(([s, n]) => <span key={s} className="rounded-full border px-3 py-1">{statusLabel(s)}: <strong>{n}</strong></span>)}
      </div>

      <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="font-semibold">Finance summary</h2><Link to="/admin/finance" className="text-sm text-accent hover:underline">Open finance</Link></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Verified collections" value={data ? inr(data.fin.collected) : "—"} icon={Wallet} />
        <Stat label="Pending" value={data ? inr(data.fin.pending) : "—"} icon={Clock} />
        <Stat label="Failed / cancelled" value={data ? inr(data.fin.failed) : "—"} icon={AlertTriangle} />
        <Stat label="Refunds recorded" value={data ? inr(data.fin.refunded) : "—"} icon={LifeBuoy} />
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Alerts</h2>
      <div className="card-surface divide-y">
        {(data?.alerts ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No open alerts.</p>}
        {data?.alerts.map((a) => { const det = (a.details ?? {}) as Record<string, string>; return (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span><strong>{ALERT_LABEL[a.kind] ?? a.kind}</strong>{det.reference ? ` · ${det.reference}` : ""}{det.reason ? ` · ${det.reason}` : ""} <span className="text-muted-foreground">· {fmtDateTime(a.created_at)}</span></span>
            <span className="flex gap-2">{det.link && <Button asChild size="sm" variant="outline"><a href={det.link}>Open</a></Button>}<Button size="sm" variant="secondary" onClick={() => ack(a.id)}>Acknowledge</Button></span>
          </div>); })}
      </div>

      <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Link to="/admin/audit" className="text-sm text-accent hover:underline">Full audit log</Link></div>
      <div className="card-surface divide-y">
        {(data?.logs ?? []).length === 0 && <p className="p-5 text-sm text-muted-foreground">No activity yet.</p>}
        {data?.logs.map((l) => <div key={l.id} className="flex justify-between gap-3 p-4 text-sm"><span><strong>{l.action}</strong> · {l.target}</span><span className="text-muted-foreground">{fmtDateTime(l.created_at)}</span></div>)}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
        <span>Overdue after (days, now {d?.overdue_days ?? 3}):</span>
        <Input aria-label="Overdue days" type="number" min={1} max={90} className="w-24" value={days} onChange={(e) => setDays(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!days} onClick={saveDays}>Save</Button>
      </div>
    </>
  );
}
