import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet, Clock, XCircle, RotateCcw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashHeader, Stat, fmtDate } from "@/components/dash/DashShell";
import { EmptyState } from "@/components/site/bits";
import { selectCls } from "@/components/site/LocationSelect";
import { bucket, inr, needsReconciliation, summarise, type FinRow } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/admin/finance")({ component: Finance });

type Row = FinRow & { id: string; ref: string | null; professional_id: string | null; pro_name: string | null; provider_order_id: string | null; created_at: string; paid_at: string | null };

function Finance() {
  const [mode, setMode] = useState<"all" | "live" | "test">("all");
  const [view, setView] = useState("");
  const { data, error, isLoading } = useQuery({
    queryKey: ["crm-finance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("crm_finance_summary");
      if (error) throw error;
      return data as unknown as { payments: Row[]; orders: Row[]; lead_fee_paise: number | null; lead_unlocks: number };
    },
  });
  if (error) return <EmptyState title="Finance is only available to administrators" />;
  const all = [...(data?.payments ?? []), ...(data?.orders ?? [])].filter((r) => mode === "all" || (mode === "test" ? r.test_mode : !r.test_mode));
  const s = summarise(all);
  const rows = all.filter((r) => !view || (view === "reconcile" ? needsReconciliation(r) : bucket(r) === view)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const byPro = new Map<string, { name: string; collected: number; n: number }>();
  for (const r of all) { const k = r.pro_name ?? "Unassigned"; const e = byPro.get(k) ?? { name: k, collected: 0, n: 0 }; e.n++; if (bucket(r) === "collected") e.collected += r.amount_paise; byPro.set(k, e); }
  return (
    <>
      <DashHeader title="Finance (read-only)" subtitle="Monitoring only. Nothing here charges, refunds or unlocks anything. “Collected” counts only payments confirmed by Razorpay with a payment ID." />
      <div className="mb-4 rounded-lg border bg-card p-3 text-sm">
        Payment collection and live lead unlocking: <strong>disabled</strong>. Lead Unlock Fee on record: <strong>{data?.lead_fee_paise != null ? inr(data.lead_fee_paise) : "—"}</strong> (calculated amount, not money received). Lead unlocks recorded: <strong>{data?.lead_unlocks ?? "—"}</strong>.
        {all.some((r) => r.test_mode) && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-semibold">Includes TEST-mode records</span>}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Mode" className={selectCls + " w-44"} value={mode} onChange={(e) => setMode(e.target.value as never)}><option value="all">Test + live</option><option value="live">Live only</option><option value="test">Test mode only</option></select>
        <select aria-label="Show" className={selectCls + " w-56"} value={view} onChange={(e) => setView(e.target.value)}><option value="">All transactions</option><option value="collected">Verified collections</option><option value="pending">Pending</option><option value="failed">Failed / cancelled</option><option value="reconcile">Needs reconciliation</option></select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Verified collections" value={isLoading ? "—" : inr(s.collected)} icon={Wallet} />
        <Stat label="Pending" value={isLoading ? "—" : inr(s.pending)} icon={Clock} />
        <Stat label="Failed / cancelled" value={isLoading ? "—" : inr(s.failed)} icon={XCircle} />
        <Stat label="Refunds recorded" value={isLoading ? "—" : inr(s.refunded)} icon={RotateCcw} />
        <Stat label="To reconcile" value={isLoading ? "—" : s.reconcile} icon={AlertTriangle} />
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Transactions</h2>
      {rows.length === 0 ? <EmptyState title="No transactions" /> : (
        <div className="card-surface overflow-x-auto"><table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Reference</th><th className="p-3">Professional</th><th className="p-3">Amount</th><th className="p-3">Refunded</th><th className="p-3">Status</th><th className="p-3">Provider ref</th></tr></thead>
          <tbody className="divide-y">{rows.map((r) => (
            <tr key={r.id}>
              <td className="p-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
              <td className="p-3">{r.kind === "credit_order" ? "Credit purchase" : "Service payment"}{r.test_mode && <span className="ml-1 rounded bg-muted px-1.5 text-xs font-semibold">TEST</span>}</td>
              <td className="p-3">{r.ref ?? "—"}</td>
              <td className="p-3">{r.professional_id ? <Link to="/professionals/$id" params={{ id: r.professional_id }} className="hover:underline">{r.pro_name ?? "Professional"}</Link> : "—"}</td>
              <td className="p-3">{inr(r.amount_paise)}</td>
              <td className="p-3">{r.refunded_paise ? inr(r.refunded_paise) : "—"}</td>
              <td className="p-3">{r.status.replace(/_/g, " ")}{needsReconciliation(r) && <span className="ml-1 text-xs font-semibold text-destructive">reconcile</span>}</td>
              <td className="p-3 font-mono text-xs">{r.provider_payment_id ?? r.provider_order_id ?? "—"}</td>
            </tr>))}</tbody></table></div>
      )}
      <h2 className="mb-3 mt-8 font-semibold">By professional</h2>
      <div className="card-surface divide-y">{[...byPro.values()].map((p) => <div key={p.name} className="flex justify-between p-3 text-sm"><span>{p.name} · {p.n} transaction(s)</span><span>{inr(p.collected)} verified</span></div>)}
        {byPro.size === 0 && <p className="p-3 text-sm text-muted-foreground">No data.</p>}</div>
    </>
  );
}
