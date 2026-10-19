// Server-only: applies verified provider outcomes to payment records. Idempotent.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isPaidState } from "./fees";

type Admin = SupabaseClient<Database>;

export async function applyPaymentOutcome(admin: Admin, o: { orderId: string; paymentId?: string; outcome: "successful" | "failed"; reason?: string }) {
  const { data: p } = await admin.from("payments").select("*").eq("provider_order_id", o.orderId).maybeSingle();
  if (!p) return { payment: null, changed: false };
  if (o.outcome === "successful") {
    if (isPaidState(p.status)) return { payment: p, changed: false };
    const { data: inv } = await admin.rpc("next_invoice_number");
    const { data } = await admin.from("payments").update({
      status: "successful", provider_payment_id: o.paymentId ?? p.provider_payment_id, paid_at: new Date().toISOString(),
      invoice_number: p.invoice_number ?? (inv as string), failure_reason: null,
    }).eq("id", p.id).not("status", "in", "(successful,refund_requested,refunded,partially_refunded)").select("*").maybeSingle();
    return { payment: data ?? p, changed: !!data };
  }
  if (isPaidState(p.status) || p.status === "failed") return { payment: p, changed: false };
  const { data } = await admin.from("payments").update({ status: "failed", provider_payment_id: o.paymentId ?? p.provider_payment_id, failure_reason: (o.reason ?? "Payment failed").slice(0, 300) })
    .eq("id", p.id).not("status", "in", "(successful,refund_requested,refunded,partially_refunded)").select("*").maybeSingle();
  return { payment: data ?? p, changed: !!data };
}

/** Records a provider-confirmed refund once (keyed by provider refund id). */
export async function applyRefund(admin: Admin, o: { providerPaymentId: string; refundId: string; amountPaise: number }) {
  const { data: p } = await admin.from("payments").select("*").eq("provider_payment_id", o.providerPaymentId).maybeSingle();
  if (!p) return false;
  // One-time lock per provider refund id, so webhook + API response never double count.
  const { error: seen } = await admin.from("payment_events").insert({ provider_event_id: `refund:${o.refundId}`, event_type: "refund.applied", payment_id: p.id });
  if (seen) return false;
  const { data: rr } = await admin.from("refund_requests").select("*").eq("provider_refund_id", o.refundId).maybeSingle();
  const refunded = Math.min(p.total_paise, p.refunded_paise + o.amountPaise);
  await admin.from("payments").update({ refunded_paise: refunded, status: refunded >= p.total_paise ? "refunded" : "partially_refunded" }).eq("id", p.id);
  if (rr) await admin.from("refund_requests").update({ status: "processed" }).eq("id", rr.id);
  return true;
}

/** Contact-credit orders: verified provider outcome → order status → ledger purchase entry (idempotent by order id). */
export async function applyCreditOutcome(admin: Admin, o: { orderId: string; paymentId?: string; outcome: "successful" | "failed"; reason?: string }) {
  const { data: c } = await admin.from("credit_orders").select("*").eq("provider_order_id", o.orderId).maybeSingle();
  if (!c) return { found: false, changed: false };
  if (o.outcome === "successful") {
    if (c.status !== "successful" && c.status !== "refunded") {
      await admin.from("credit_orders").update({ status: "successful", provider_payment_id: o.paymentId ?? c.provider_payment_id, paid_at: new Date().toISOString(), failure_reason: null })
        .eq("id", c.id).not("status", "in", "(successful,refunded)");
    }
    const { data: granted } = await admin.rpc("grant_order_credits", { _order_id: c.id });
    return { found: true, changed: !!granted };
  }
  if (c.status === "successful" || c.status === "refunded" || c.status === "failed") return { found: true, changed: false };
  await admin.from("credit_orders").update({ status: "failed", provider_payment_id: o.paymentId ?? c.provider_payment_id, failure_reason: (o.reason ?? "Payment failed").slice(0, 300) }).eq("id", c.id).not("status", "in", "(successful,refunded)");
  return { found: true, changed: true };
}
