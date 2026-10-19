import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { reviewRefund, syncRefund } from "@/lib/payments.functions";
import { PAYMENT_STATES, inr } from "@/lib/fees";
import { DashHeader, fmtDate, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { TestModeBadge } from "@/components/dash/PaymentBreakdown";
import { selectCls } from "@/components/site/LocationSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/payments")({ component: Payments });

type FeeModel = { default_platform_fee_paise: number; platform_gst_percent: number; refund_window_days: number; refund_terms: string; compliance_note: string };

function Payments() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const review = useServerFn(reviewRefund), sync = useServerFn(syncRefund);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const [p, r, people, reqs, ev, legacy, fm] = await Promise.all([
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("refund_requests").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.rpc("staff_directory"),
        supabase.from("service_requests").select("id,reference").limit(1000),
        supabase.from("payment_events").select("*").order("received_at", { ascending: false }).limit(50),
        supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("platform_settings").select("value").eq("key", "fee_model").maybeSingle(),
      ]);
      return { pays: p.data ?? [], refunds: r.data ?? [], people: people.data ?? [], reqs: reqs.data ?? [], events: ev.data ?? [], legacy: legacy.data ?? [], model: fm.data?.value as FeeModel | undefined };
    },
  });
  const [fm, setFm] = useState({ fee: "", gst: "", days: "", terms: "" });
  useEffect(() => { if (data?.model) setFm({ fee: String((data.model.default_platform_fee_paise ?? 0) / 100), gst: String(data.model.platform_gst_percent ?? 18), days: String(data.model.refund_window_days ?? 7), terms: data.model.refund_terms ?? "" }); }, [data?.model]);
  const who = (id: string) => { const p = data?.people.find((x) => x.id === id); return p?.full_name || p?.email || id.slice(0, 8); };
  const ref = (id: string) => data?.reqs.find((r) => r.id === id)?.reference ?? "—";
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-payments"] });

  const decide = async (id: string, approve: boolean) => {
    const note = (notes[id] ?? "").trim();
    if (note.length < 5) return toast.error("Add a review note (at least 5 characters)");
    try { await review({ data: { refundId: id, approve, note } }); toast.success(approve ? "Refund approved (test)" : "Refund rejected"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't review refund"); }
  };
  const saveModel = async () => {
    const value = { ...(data?.model ?? {}), default_platform_fee_paise: Math.round((parseFloat(fm.fee) || 0) * 100), platform_gst_percent: Math.min(100, Math.max(0, parseFloat(fm.gst) || 0)), refund_window_days: Math.max(0, parseInt(fm.days) || 0), refund_terms: fm.terms.trim().slice(0, 2000) };
    const { error } = await supabase.from("platform_settings").upsert({ key: "fee_model", value, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Fee model saved"); refresh();
  };
  const list = (data?.pays ?? []).filter((p) => !status || p.status === status);
  const pendingRefunds = (data?.refunds ?? []).filter((r) => r.status === "requested");

  return (
    <>
      <DashHeader title="Payments & refunds" subtitle="Transactions, invoices and refunds. Payment status is set only by verified Razorpay events." />
      <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"><strong>TEST MODE.</strong> Only Razorpay test keys are accepted; live payments are disabled. No real money moves.</div>
      <div className="mb-6 rounded-xl border bg-muted p-4 text-xs text-muted-foreground"><strong className="text-foreground">Compliance note (internal):</strong> {data?.model?.compliance_note ?? "Professional fee-sharing, referral fees, commissions and platform charges for regulated professionals must be reviewed for compliance with applicable Indian professional regulations before production launch."}</div>

      <h2 className="mb-2 font-semibold">Refund requests ({pendingRefunds.length} awaiting review)</h2>
      {(data?.refunds ?? []).length === 0 ? <div className="mb-6"><EmptyState title="No refund requests" /></div> : (
        <div className="card-surface mb-6 divide-y">{(data?.refunds ?? []).map((r) => (
          <div key={r.id} className="grid gap-2 p-4">
            <div className="flex flex-wrap items-center gap-3"><p className="flex-1 font-medium">{inr(r.amount_paise)} · {who(r.customer_id)}</p><StatusPill status={r.status} /></div>
            <p className="text-sm">{r.reason}</p>
            <p className="text-xs text-muted-foreground">Requested {fmtDateTime(r.created_at)}{r.reviewed_at ? ` · Reviewed ${fmtDateTime(r.reviewed_at)} by ${who(r.reviewer_id ?? "")} · ${r.review_note}` : ""}{r.provider_refund_id ? ` · Ref ${r.provider_refund_id}` : ""}</p>
            {isAdmin && r.status === "approved" && r.provider_refund_id && (
              <Button size="sm" variant="outline" className="w-fit" onClick={async () => {
                try { const v = await sync({ data: { refundId: r.id } }); toast[v.status === "processed" ? "success" : "message"](v.status === "processed" ? "Refund confirmed by Razorpay (test)" : `Razorpay status: ${v.status}`); refresh(); }
                catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't check refund"); }
              }}>Check refund status with Razorpay</Button>
            )}
            {isAdmin && r.status === "requested" && (
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-60 flex-1" placeholder="Review note (required)" value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} aria-label="Refund review note" />
                <Button size="sm" variant="accent" onClick={() => decide(r.id, true)}>Approve & refund (test)</Button>
                <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Reject</Button>
              </div>
            )}
          </div>
        ))}</div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Transactions <TestModeBadge /></h2>
        <select aria-label="Filter by payment status" className={selectCls + " w-52"} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{PAYMENT_STATES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select></div>
      {list.length === 0 ? <div className="mb-6"><EmptyState title="No transactions" /></div> : (
        <div className="card-surface mb-6 divide-y">{list.map((p) => (
          <div key={p.id} className="p-4">
            <button className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <div className="min-w-0 flex-1"><p className="font-medium">{p.description}</p>
                <p className="text-xs text-muted-foreground">{who(p.customer_id)} · Request {ref(p.request_id)} · {p.invoice_number ?? "no invoice"} · {fmtDate(p.created_at)}{p.test_mode ? " · TEST MODE" : ""}</p></div>
              <p className="font-semibold">{inr(p.total_paise)}</p><StatusPill status={p.status} />
            </button>
            {open === p.id && (
              <dl className="mt-3 grid gap-2 rounded-lg bg-muted p-3 text-xs sm:grid-cols-3">
                <F k="Professional fee" v={inr(p.professional_fee_paise)} /><F k="Tax on professional fee" v={inr(p.professional_tax_paise)} />
                <F k="Platform fee" v={inr(p.platform_fee_paise)} /><F k="GST on platform fee" v={inr(p.platform_tax_paise)} />
                <F k="Government fees" v={inr(p.government_fee_paise)} /><F k="Refunded" v={inr(p.refunded_paise)} />
                <F k="Order reference" v={p.provider_order_id ?? "—"} /><F k="Payment reference" v={p.provider_payment_id ?? "—"} />
                <F k="Paid at" v={p.paid_at ? fmtDateTime(p.paid_at) : "—"} />
                {p.failure_reason && <F k="Failure reason" v={p.failure_reason} />}
                <div className="sm:col-span-3"><Link to="/dashboard/requests/$id" params={{ id: p.request_id }} className="text-accent hover:underline">Open service request</Link></div>
              </dl>
            )}
          </div>
        ))}</div>
      )}

      {isAdmin && (
        <div className="card-surface mb-6 grid gap-3 p-5">
          <h2 className="font-semibold">Fee model (review before launch)</h2>
          <p className="text-xs text-muted-foreground">The professional fee is always entered by the professional and passed on in full. A service-specific platform fee (Services & categories) overrides the default below.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Default platform fee (₹)<Input type="number" min={0} value={fm.fee} onChange={(e) => setFm({ ...fm, fee: e.target.value })} /></label>
            <label className="text-xs">GST on platform fee (%)<Input type="number" min={0} max={100} value={fm.gst} onChange={(e) => setFm({ ...fm, gst: e.target.value })} /></label>
            <label className="text-xs">Refund request window (days)<Input type="number" min={0} value={fm.days} onChange={(e) => setFm({ ...fm, days: e.target.value })} /></label>
          </div>
          <label className="text-xs">Refund & cancellation terms shown at checkout<Textarea rows={3} value={fm.terms} maxLength={2000} onChange={(e) => setFm({ ...fm, terms: e.target.value })} /></label>
          <Button className="w-fit" variant="outline" onClick={saveModel}>Save fee model</Button>
        </div>
      )}

      <details className="card-surface mb-6 p-5 text-sm"><summary className="cursor-pointer font-semibold">Webhook events (latest 50)</summary>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{(data?.events ?? []).map((e) => <li key={e.id}>{fmtDateTime(e.received_at)} · {e.event_type} · {e.outcome ?? "—"}</li>)}</ul>
      </details>
      {(data?.legacy ?? []).length > 0 && (
        <details className="card-surface p-5 text-sm"><summary className="cursor-pointer font-semibold">Earlier manual test records</summary>
          <ul className="mt-2 space-y-1">{data!.legacy.map((i) => <li key={i.id} className="text-xs">{i.description} · {inr(i.amount_paise)} · {i.status} · {who(i.user_id)}</li>)}</ul>
        </details>
      )}
    </>
  );
}

function F({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
