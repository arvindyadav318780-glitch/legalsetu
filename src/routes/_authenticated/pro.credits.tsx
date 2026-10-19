import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashHeader, fmtDateTime } from "@/components/dash/DashShell";
import { EmptyState, StatusPill } from "@/components/site/bits";
import { TestModeBadge } from "@/components/dash/PaymentBreakdown";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/fees";
import { CONNECTION_FEE_PAISE, CREDIT_PACKS, creditsRequired, type MarketSettings } from "@/lib/marketplace";
import { cancelCreditPurchase, startCreditPurchase, verifyCreditPurchase } from "@/lib/credits.functions";
import { ProConnectionFees } from "@/components/dash/ConnectionFees";

export const Route = createFileRoute("/_authenticated/pro/credits")({ component: Credits });

const loadRazorpay = () => new Promise<boolean>((res) => {
  if (window.Razorpay) return res(true);
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
});

function Credits() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const start = useServerFn(startCreditPurchase), verify = useServerFn(verifyCreditPurchase), cancel = useServerFn(cancelCreditPurchase);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["my-credits", user?.id], enabled: !!user,
    queryFn: async () => {
      const [bal, led, ord, s, pro, rf, tk] = await Promise.all([
        supabase.rpc("credit_balance", { _uid: user!.id }),
        supabase.from("credit_ledger").select("*").eq("professional_id", user!.id).order("created_at", { ascending: false }).limit(200),
        supabase.from("credit_orders").select("*").eq("professional_id", user!.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("marketplace_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("professional_profiles").select("category").eq("user_id", user!.id).maybeSingle(),
        supabase.from("credit_refunds").select("*").eq("professional_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("support_tickets").select("id,subject,status,created_at").eq("user_id", user!.id).like("subject", "Credit-pack refund request:%"),
      ]);
      return { balance: (bal.data as number) ?? 0, ledger: led.data ?? [], orders: ord.data ?? [], settings: s.data as MarketSettings | null, category: pro.data?.category ?? null, refunds: rf.data ?? [], refundTickets: tk.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-credits"] });
  const enabled = creditsRequired(data?.category, data?.settings);
  const price = data?.settings?.contact_price_paise ?? 0;

  const buy = async (credits: number) => {
    setBusy(true);
    try {
      const o = await start({ data: { credits } });
      if (!(await loadRazorpay())) throw new Error("Couldn't load the secure checkout");
      const rz = new window.Razorpay!({
        key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: "LegalSetu (TEST MODE)", description: `${credits} contact credits`,
        handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const v = await verify({ data: { orderRowId: o.orderRowId, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature } });
          toast[v.status === "successful" ? "success" : "message"](v.status === "successful" ? "Payment verified — credits added (test)" : "Waiting for confirmation from Razorpay");
          setBusy(false); refresh();
        },
        modal: { ondismiss: async () => { await cancel({ data: { orderRowId: o.orderRowId } }); setBusy(false); refresh(); } },
      });
      rz.on("payment.failed", () => toast.error("Payment failed. No credits were added."));
      rz.open();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't start checkout"); setBusy(false); }
  };

  const requestRefund = async (orderId: string, credits: number) => {
    const reason = window.prompt("Why do you want a refund for this pack? (at least 10 characters). Only fully unused packs can be refunded.");
    if (!reason) return;
    if (reason.trim().length < 10) return toast.error("Please give a little more detail (10+ characters)");
    const { error } = await supabase.from("support_tickets").insert({ user_id: user!.id, kind: "support", subject: `Credit-pack refund request: order ${orderId.slice(0, 8)} (${credits} credits)`, body: `Order ID: ${orderId}\n\n${reason.trim().slice(0, 2000)}` });
    if (error) return toast.error("Couldn't send the request");
    toast.success("Refund request sent. An administrator will review it; the refund is confirmed only after Razorpay processes it."); refresh();
  };

  return (
    <>
      <DashHeader title="Client connections & credits" subtitle="1 credit = 1 new unique client connection. Credits are separate from your professional fees. LegalSetu never deducts anything from what clients pay you." />
      {!enabled ? (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"><strong>Not active.</strong> Paid contact is switched off for your profession while it is reviewed under BCI / ICAI rules and other applicable law. Accepting client contact requests is free in the meantime.</div>
      ) : (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm"><strong>TEST MODE.</strong> {inr(price)} per new unique client. A credit is used only when the conversation with a client opens for the first time. Further messages or requests from the same client are free. Declined requests are free.</div>
      )}
      {user && <ProConnectionFees userId={user.id} active={enabled} pricePaise={price || CONNECTION_FEE_PAISE} />}
      <div className="card-surface mb-6 flex flex-wrap items-center gap-4 p-5">
        <div className="flex-1"><p className="text-sm text-muted-foreground">Balance (calculated from your ledger)</p><p className="text-3xl font-semibold">{data?.balance ?? 0} credits</p></div>
        {CREDIT_PACKS.map((n) => <Button key={n} variant="outline" disabled={!enabled || busy} onClick={() => buy(n)}>Buy {n} · {enabled ? inr(n * price) : "—"}</Button>)}
      </div>
      <h2 className="mb-2 font-semibold">Ledger</h2>
      {(data?.ledger ?? []).length === 0 ? <EmptyState title="No credit activity" /> : (
        <div className="card-surface mb-6 divide-y text-sm">{data!.ledger.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{l.kind} · {l.note ?? ""}</span><span className={l.delta < 0 ? "text-destructive" : "text-success"}>{l.delta > 0 ? "+" : ""}{l.delta}</span><span className="text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span></div>
        ))}</div>
      )}
      <h2 className="mb-2 font-semibold">Credit purchases <TestModeBadge /></h2>
      {(data?.orders ?? []).length === 0 ? <EmptyState title="No purchases" /> : (
        <div className="card-surface divide-y text-sm">{data!.orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{o.credits} credits · {inr(o.amount_paise)}{o.provider_payment_id ? ` · ${o.provider_payment_id}` : ""}</span><StatusPill status={o.status} /><span className="text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</span></div>
        ))}</div>
      )}
      {(data?.orders ?? []).some((o) => o.status === "successful") && (
        <div className="card-surface mt-4 divide-y text-sm">{data!.orders.filter((o) => o.status === "successful").map((o) => {
          const asked = data!.refundTickets.some((t) => t.subject.includes(o.id.slice(0, 8)));
          const rf = data!.refunds.find((r) => r.order_id === o.id && r.status !== "failed");
          return <div key={o.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{o.credits} credits · {inr(o.amount_paise)} · {fmtDateTime(o.created_at)}</span>
            {rf ? <StatusPill status={rf.status} /> : asked ? <span className="text-xs text-muted-foreground">Refund requested — under review</span> : <Button size="sm" variant="outline" onClick={() => requestRefund(o.id, o.credits)}>Request refund</Button>}</div>;
        })}</div>
      )}
      <h2 className="mb-2 mt-6 font-semibold">Refunds</h2>
      {(data?.refunds ?? []).length === 0 ? <EmptyState title="No refunds" body="A refund shows as processed only after Razorpay confirms it. If Razorpay refuses, your credits are restored." /> : (
        <div className="card-surface divide-y text-sm">{data!.refunds.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3"><span className="flex-1">{r.credits_reversed} credits · {inr(r.amount_paise)}{r.failure_reason ? ` · ${r.failure_reason}` : ""}</span><StatusPill status={r.status} /><span className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</span></div>
        ))}</div>
      )}
    </>
  );
}
