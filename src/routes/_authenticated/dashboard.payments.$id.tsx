import { createFileRoute, Link } from "@tanstack/react-router";
import { ProLink } from "@/components/site/ProAvatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cancelCheckout, requestRefund, startCheckout, verifyCheckout } from "@/lib/payments.functions";
import { canPay, inr, refundableRemaining } from "@/lib/fees";
import { fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { PaymentBreakdown, TestModeBadge } from "@/components/dash/PaymentBreakdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard/payments/$id")({
  head: () => ({ meta: [{ title: "Checkout (Test mode) — LegalSetu" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: any) => void) => void } } }
const loadRazorpay = () => new Promise<boolean>((res) => {
  if (window.Razorpay) return res(true);
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
});

function Checkout() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const start = useServerFn(startCheckout), verify = useServerFn(verifyCheckout), cancel = useServerFn(cancelCheckout), refund = useServerFn(requestRefund);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rf, setRf] = useState({ amt: "", reason: "" });
  const key = ["payment", id];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: p } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
      if (!p) return null;
      const [r, s, pn, rr] = await Promise.all([
        supabase.from("service_requests").select("id,reference,service_name,contact_name,assigned_professional_id").eq("id", p.request_id).maybeSingle(),
        supabase.from("platform_settings").select("value").eq("key", "fee_model").maybeSingle(),
        supabase.rpc("assigned_professional_name", { _rid: p.request_id }),
        supabase.from("refund_requests").select("*").eq("payment_id", id).order("created_at", { ascending: false }),
      ]);
      return { p, req: r.data, terms: ((s.data?.value as Record<string, unknown> | undefined)?.refund_terms as string) ?? "Refunds are reviewed under LegalSetu's refund policy.", proName: pn.data as string | null, refunds: rr.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (!data) return <EmptyState title="Payment not found" action={<Button asChild><Link to="/dashboard/billing">Back to billing</Link></Button>} />;
  const { p } = data;
  const isOwner = p.customer_id === user?.id;

  const pay = async () => {
    if (!confirmed) return toast.error("Please confirm the amount first");
    setBusy(true);
    try {
      if (!(await loadRazorpay())) throw new Error("Couldn't load the secure checkout");
      const o = await start({ data: { paymentId: id, confirmed: true } });
      const rz = new window.Razorpay!({
        key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: "LegalSetu (TEST MODE)", description: o.description,
        prefill: { email: user?.email ?? "" }, theme: { color: "#0F9D8A" },
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const v = await verify({ data: { paymentId: id, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature } });
          toast[v.status === "successful" ? "success" : "message"](v.status === "successful" ? "Payment confirmed by Razorpay (test)" : "Payment received — waiting for confirmation from Razorpay");
          setBusy(false); refresh();
        },
        modal: { ondismiss: async () => { await cancel({ data: { paymentId: id } }); setBusy(false); refresh(); } },
      });
      rz.on("payment.failed", () => { toast.error("Payment failed. You can try again."); setTimeout(refresh, 1500); });
      rz.open();
    } catch (e) { setBusy(false); toast.error(e instanceof Error ? e.message : "Couldn't start checkout"); refresh(); }
  };
  const askRefund = async () => {
    const amt = Math.round(parseFloat(rf.amt) * 100);
    try { await refund({ data: { paymentId: id, amountPaise: amt, reason: rf.reason } }); toast.success("Refund request sent for review"); setRf({ amt: "", reason: "" }); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't request refund"); }
  };

  return (
    <>
      <Link to="/dashboard/billing" className="text-sm text-accent hover:underline">← Billing</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{p.invoice_number ? "Invoice" : "Checkout"}</h1><TestModeBadge /></div>
          <p className="text-sm text-muted-foreground">{data.req?.service_name} · Request {data.req?.reference}</p></div>
        <StatusPill status={p.status} />
      </div>
      <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"><strong>TEST MODE.</strong> No real money is charged. Use Razorpay test cards or test UPI only.</div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card-surface p-5">
          <h2 className="font-semibold">{p.description}</h2>
          <p className="mb-3 text-xs text-muted-foreground">Professional: {data.proName ? <ProLink id={p.professional_id ?? data.req?.assigned_professional_id}>{data.proName}</ProLink> : "Not yet assigned"}</p>
          <PaymentBreakdown p={p} proName={data.proName} />
          {p.invoice_number && (
            <dl className="mt-4 grid gap-1 rounded-lg bg-muted p-3 text-xs sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Invoice number</dt><dd className="font-mono font-semibold">{p.invoice_number}</dd></div>
              <div><dt className="text-muted-foreground">Customer</dt><dd>{data.req?.contact_name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Request ID</dt><dd className="font-mono">{data.req?.reference ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Payment reference</dt><dd className="font-mono">{p.provider_payment_id ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Payment date</dt><dd>{p.paid_at ? fmtDateTime(p.paid_at) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Status</dt><dd>{p.status.replace(/_/g, " ")}</dd></div>
            </dl>
          )}
          {p.failure_reason && p.status === "failed" && <p className="mt-3 text-sm text-destructive">Last attempt failed: {p.failure_reason}</p>}
        </section>
        <div className="space-y-6">
          <section className="card-surface space-y-3 p-5">
            <h2 className="font-semibold">Refund & cancellation terms</h2>
            <p className="text-sm text-muted-foreground">{data.terms}</p>
          </section>
          {isOwner && canPay(p.status) && (
            <section className="card-surface space-y-3 p-5">
              <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} aria-label="Confirm amount" />
                <span>I confirm the total of <strong>{inr(p.total_paise)}</strong>, the separate fee lines above and the refund terms.</span></label>
              <Button variant="accent" className="w-full" disabled={!confirmed || busy} onClick={pay}>{busy ? "Opening secure checkout…" : `Pay ${inr(p.total_paise)} (test)`}</Button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Card and UPI details are entered on Razorpay's secure page. LegalSetu never sees or stores them.</p>
            </section>
          )}
          {p.status === "initiated" && <p className="card-surface p-5 text-sm text-muted-foreground">Waiting for confirmation from Razorpay. This page updates once the payment is verified.</p>}
          {isOwner && ["successful", "partially_refunded"].includes(p.status) && (
            <section className="card-surface space-y-2 p-5">
              <h2 className="font-semibold">Request a refund</h2>
              <Input type="number" min={1} placeholder={`Amount in ₹ (max ${inr(refundableRemaining(p))})`} value={rf.amt} onChange={(e) => setRf({ ...rf, amt: e.target.value })} aria-label="Refund amount" />
              <Textarea rows={3} placeholder="Reason (at least 10 characters)" maxLength={1000} value={rf.reason} onChange={(e) => setRf({ ...rf, reason: e.target.value })} aria-label="Refund reason" />
              <Button variant="outline" onClick={askRefund}>Submit refund request</Button>
            </section>
          )}
          {data.refunds.length > 0 && (
            <section className="card-surface p-5">
              <h2 className="font-semibold">Refund history</h2>
              <ul className="mt-2 space-y-2 text-sm">{data.refunds.map((r) => (
                <li key={r.id} className="rounded-lg border p-2.5"><div className="flex justify-between"><span>{inr(r.amount_paise)}</span><StatusPill status={r.status} /></div>
                  <p className="text-xs text-muted-foreground">Requested {fmtDateTime(r.created_at)} · {r.reason}</p>
                  {r.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed {fmtDateTime(r.reviewed_at)} · {r.review_note}</p>}</li>
              ))}</ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
