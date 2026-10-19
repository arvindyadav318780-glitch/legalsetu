import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, Stat, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { inr } from "@/lib/fees";
import { canEnableGate, CONNECTION_FEE_PAISE } from "@/lib/marketplace";
import { Coins, MessageSquare, RotateCcw, ShoppingCart } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { refundCreditPack, syncCreditRefund } from "@/lib/credits.functions";
import { exportMarketplaceSummary } from "@/lib/sheets.functions";
import { AdminConnectionFees } from "@/components/dash/ConnectionFees";

export const Route = createFileRoute("/_authenticated/admin/marketplace")({ component: Marketplace });

function Marketplace() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const refundPack = useServerFn(refundCreditPack), syncRefund = useServerFn(syncCreditRefund), exportSheet = useServerFn(exportMarketplaceSummary);
  const [adj, setAdj] = useState({ pro: "", delta: "", reason: "" });
  const { data } = useQuery({
    queryKey: ["admin-mkt"],
    queryFn: async () => {
      const [s, led, ord, cr, rf] = await Promise.all([
        supabase.from("marketplace_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("credit_ledger").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("credit_orders").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("contact_requests").select("id,status").limit(2000),
        supabase.from("credit_refunds").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      return { s: s.data, ledger: led.data ?? [], orders: ord.data ?? [], cr: cr.data ?? [], refunds: rf.data ?? [] };
    },
  });
  const [f, setF] = useState({ price: "99", ca: false, adv: false, pca: false, padv: false, note: "", date: "" });
  useEffect(() => { if (data?.s) setF({ price: String(data.s.contact_price_paise / 100), ca: data.s.credits_enabled_ca, adv: data.s.credits_enabled_advocate, pca: data.s.pro_initiate_ca, padv: data.s.pro_initiate_advocate, note: data.s.legal_review_note ?? "", date: data.s.legal_review_completed_at ?? "" }); }, [data?.s]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-mkt"] });

  const save = async () => {
    const turningOn = (f.ca || f.adv || f.pca || f.padv);
    if (turningOn && !canEnableGate(f.note, f.date)) return toast.error("Record the completed legal review (date + note of 20+ characters) first");
    const { error } = await supabase.from("marketplace_settings").update({
      contact_price_paise: Math.max(0, Math.round((parseFloat(f.price) || 0) * 100)), credits_enabled_ca: f.ca, credits_enabled_advocate: f.adv,
      pro_initiate_ca: f.pca, pro_initiate_advocate: f.padv, legal_review_note: f.note.trim().slice(0, 2000) || null, legal_review_completed_at: f.date || null,
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Marketplace settings saved"); refresh();
  };
  const reverse = async (id: string) => {
    const note = window.prompt("Refund reason (at least 5 characters)");
    if (!note) return;
    const { error } = await supabase.rpc("admin_reverse_credit", { _ledger_id: id, _note: note });
    if (error) return toast.error(error.message);
    toast.success("Credit returned to the professional"); refresh();
  };

  const ledger = data?.ledger ?? [];
  const paidOrders = (data?.orders ?? []).filter((o) => o.status === "successful" || o.status === "refunded");
  const refunds = data?.refunds ?? [];
  const doAdjust = async () => {
    const { error } = await supabase.rpc("admin_adjust_credits", { _pro: adj.pro.trim(), _delta: parseInt(adj.delta) || 0, _reason: adj.reason });
    if (error) return toast.error(error.message);
    toast.success("Credits adjusted and recorded"); setAdj({ pro: "", delta: "", reason: "" }); refresh();
  };
  const doRefund = async (orderId: string) => {
    const note = window.prompt("Refund reason (at least 5 characters). Only fully unused packs can be refunded.");
    if (!note) return;
    try { const r = await refundPack({ data: { orderId, note } }); toast[r.status === "failed" ? "error" : "success"](r.status === "processed" ? "Refund confirmed by Razorpay (test)" : r.status === "pending" ? "Refund sent — waiting for Razorpay confirmation" : "Razorpay refused the refund; credits restored"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Refund failed"); }
  };
  const doExport = async () => {
    try { const r = await exportSheet(); toast.success("Exported to Google Sheets"); window.open(r.url, "_blank", "noopener"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); }
  };
  const purchaseByOrder = new Set(ledger.filter((l) => l.kind === "purchase").map((l) => l.order_id));
  const reversed = new Set(ledger.filter((l) => l.reverses_id).map((l) => l.reverses_id));
  const mismatches = [
    ...paidOrders.filter((o) => !purchaseByOrder.has(o.id)).map((o) => ({ id: o.id, issue: "Paid order has no credit entry" })),
    ...ledger.filter((l) => l.kind === "purchase" && !paidOrders.some((o) => o.id === l.order_id)).map((l) => ({ id: l.id, issue: "Credit entry without a verified paid order" })),
    ...refunds.filter((r) => r.status === "processed" && (data?.orders ?? []).find((o) => o.id === r.order_id)?.status !== "refunded").map((r) => ({ id: r.id, issue: "Processed refund but order not marked refunded" })),
    ...refunds.filter((r) => r.status === "pending" && Date.now() - new Date(r.created_at).getTime() > 864e5 * 2).map((r) => ({ id: r.id, issue: "Refund pending for more than 2 days — check status with Razorpay" })),
  ];
  const sales = paidOrders.reduce((a, o) => a + o.amount_paise, 0);
  const used = ledger.filter((l) => l.kind === "consume").length;
  const refunded = ledger.filter((l) => l.kind === "refund").length;

  return (
    <>
      <DashHeader title="Marketplace & contact credits" subtitle="Compliance switch, credit sales, usage, refunds and reconciliation. Balances come only from the append-only ledger." />
      <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <strong>Compliance gate.</strong> Paid contact and professional-initiated contact stay OFF until a qualified lawyer has reviewed the model under the BCI Rules (Part VI, Ch. II, incl. Rules 36–37), the ICAI Code of Ethics, the DPDP Act 2023, the Consumer Protection (E-Commerce) Rules 2020, GST and Razorpay's terms. LegalSetu does not take any share of professional fees.
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Credit sales (test)" value={inr(sales)} icon={ShoppingCart} />
        <Stat label="Credits used" value={used} icon={Coins} />
        <Stat label="Credits refunded" value={refunded} icon={RotateCcw} />
        <Stat label="Contact requests" value={(data?.cr ?? []).length} icon={MessageSquare} />
      </div>

      <div className="card-surface mb-6 grid gap-3 p-5">
        <h2 className="font-semibold">Settings</h2>
        <label className="text-xs">Platform fee per new unique client connection, paid by the professional (₹) — proposed, subject to legal approval<Input type="number" min={0} disabled={!isAdmin} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
        <Toggle label="Paid contact for Chartered Accountants" v={f.ca} on={(v) => setF({ ...f, ca: v })} disabled={!isAdmin} />
        <Toggle label="Paid contact for Advocates" v={f.adv} on={(v) => setF({ ...f, adv: v })} disabled={!isAdmin} />
        <Toggle label="CAs may start contact with clients (needs legal review)" v={f.pca} on={(v) => setF({ ...f, pca: v })} disabled={!isAdmin} />
        <Toggle label="Advocates may start contact with clients (not recommended: BCI solicitation rules)" v={f.padv} on={(v) => setF({ ...f, padv: v })} disabled={!isAdmin} />
        <label className="text-xs">Legal review completed on<Input type="date" disabled={!isAdmin} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="text-xs">Legal review record (who reviewed, scope, conclusion)<Textarea rows={3} disabled={!isAdmin} value={f.note} maxLength={2000} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {isAdmin && <Button className="w-fit" variant="outline" onClick={save}>Save settings</Button>}
      </div>

      <AdminConnectionFees active={!!(data?.s?.credits_enabled_ca || data?.s?.credits_enabled_advocate)} pricePaise={data?.s?.contact_price_paise ?? CONNECTION_FEE_PAISE} orders={data?.orders ?? []} refunds={refunds} />


      {isAdmin && (
        <div className="card-surface mb-6 grid gap-3 p-5">
          <h2 className="font-semibold">Adjust a professional's credits</h2>
          <p className="text-xs text-muted-foreground">For corrections only. Every adjustment is written to the ledger and audit log with your name and reason. Balance can never go below zero.</p>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_3fr_auto]">
            <Input placeholder="Professional user ID" value={adj.pro} onChange={(e) => setAdj({ ...adj, pro: e.target.value })} aria-label="Professional user ID" />
            <Input type="number" placeholder="+/- credits" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} aria-label="Credit change" />
            <Input placeholder="Reason (10+ characters)" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} aria-label="Reason" />
            <Button variant="outline" onClick={doAdjust}>Apply</Button>
          </div>
        </div>
      )}
      {isAdmin && (
        <div className="card-surface mb-6 flex flex-wrap items-center gap-3 p-5">
          <div className="flex-1"><h2 className="font-semibold">Export summary to Google Sheets</h2><p className="text-xs text-muted-foreground">Reporting only — totals and counts. No messages, documents, contact details or payment credentials are exported. Each export is logged.</p></div>
          <Button variant="outline" onClick={doExport}>Export now</Button>
        </div>
      )}

      <h2 className="mb-2 font-semibold">Credit-pack refunds</h2>
      {refunds.length === 0 ? <div className="mb-6"><EmptyState title="No credit-pack refunds" /></div> : (
        <div className="card-surface mb-6 divide-y text-sm">{refunds.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="flex-1">{r.professional_id.slice(0, 8)} · {r.credits_reversed} credits · {inr(r.amount_paise)} · {r.provider_refund_id || "no Razorpay ref"} · {r.note}{r.failure_reason ? ` · ${r.failure_reason}` : ""}</span>
            <StatusPill status={r.status} /><span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span>
            {isAdmin && r.status === "pending" && r.provider_refund_id && <Button size="sm" variant="outline" onClick={async () => { try { const v = await syncRefund({ data: { refundId: r.id } }); toast.message(`Razorpay status: ${v.status}`); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Check failed"); } }}>Check with Razorpay</Button>}
          </div>
        ))}</div>
      )}

      <h2 className="mb-2 font-semibold">Reconciliation ({mismatches.length} issue{mismatches.length === 1 ? "" : "s"})</h2>
      {mismatches.length === 0 ? <div className="mb-6"><EmptyState title="Ledger matches verified orders" /></div> : (
        <ul className="card-surface mb-6 divide-y text-sm">{mismatches.map((m) => <li key={m.id} className="p-3">{m.issue} · {m.id.slice(0, 8)}</li>)}</ul>
      )}

      <h2 className="mb-2 font-semibold">Credit orders</h2>
      {(data?.orders ?? []).length === 0 ? <div className="mb-6"><EmptyState title="No credit orders" /></div> : (
        <div className="card-surface mb-6 divide-y text-sm">{data!.orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{o.professional_id.slice(0, 8)} · {o.credits} credits · {inr(o.amount_paise)} · {o.provider_order_id ?? "—"}{o.test_mode ? " · TEST" : ""}</span><StatusPill status={o.status} /><span className="text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</span>{isAdmin && o.status === "successful" && o.provider_payment_id && !refunds.some((r) => r.order_id === o.id && r.status !== "failed") && <Button size="sm" variant="outline" onClick={() => doRefund(o.id)}>Refund pack</Button>}</div>
        ))}</div>
      )}

      <h2 className="mb-2 font-semibold">Ledger</h2>
      {ledger.length === 0 ? <EmptyState title="No ledger entries" /> : (
        <div className="card-surface divide-y text-sm">{ledger.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="flex-1">{l.kind} · {l.professional_id.slice(0, 8)} · {l.note ?? ""}</span>
            <span>{l.delta > 0 ? "+" : ""}{l.delta}</span><span className="text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span>
            {isAdmin && l.kind === "consume" && !reversed.has(l.id) && <Button size="sm" variant="outline" onClick={() => reverse(l.id)}>Refund credit</Button>}
          </div>
        ))}</div>
      )}
    </>
  );
}

function Toggle({ label, v, on, disabled }: { label: string; v: boolean; on: (v: boolean) => void; disabled?: boolean }) {
  return <div className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{label}</span><Switch checked={v} onCheckedChange={on} disabled={disabled} aria-label={label} /></div>;
}
