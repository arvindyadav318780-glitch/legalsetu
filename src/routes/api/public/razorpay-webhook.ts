import { createFileRoute } from "@tanstack/react-router";

// Razorpay TEST webhook. Signature verified over the raw body; each event id processed once.
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const body = await request.text();
        if (body.length > 200_000) return new Response("Too large", { status: 413 });
        const { hmacHex, safeEqual } = await import("@/lib/razorpay.server");
        const sig = request.headers.get("x-razorpay-signature") ?? "";
        if (!safeEqual(await hmacHex(secret, body), sig)) return new Response("Invalid signature", { status: 401 });

        let evt: { event?: string; payload?: any };
        try { evt = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
        const eventId = request.headers.get("x-razorpay-event-id") ?? (await hmacHex("id", body));
        const type = String(evt.event ?? "unknown").slice(0, 60);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: dup } = await supabaseAdmin.from("payment_events").insert({ provider_event_id: eventId.slice(0, 120), event_type: type });
        if (dup) return Response.json({ ok: true, duplicate: true });

        const { applyPaymentOutcome, applyRefund, applyCreditOutcome } = await import("@/lib/payments.server");
        const pay = evt.payload?.payment?.entity;
        let outcome = "ignored";
        let paymentRowId: string | null = null;
        if ((type === "payment.captured" || type === "payment.authorized" || type === "order.paid") && pay?.order_id) {
          const r = await applyPaymentOutcome(supabaseAdmin, { orderId: String(pay.order_id), paymentId: String(pay.id), outcome: "successful" });
          outcome = r.changed ? "marked_successful" : "no_change"; paymentRowId = r.payment?.id ?? null;
          if (!r.payment) { const c = await applyCreditOutcome(supabaseAdmin, { orderId: String(pay.order_id), paymentId: String(pay.id), outcome: "successful" }); if (c.found) outcome = c.changed ? "credits_granted" : "credits_no_change"; }
        } else if (type === "payment.failed" && pay?.order_id) {
          const r = await applyPaymentOutcome(supabaseAdmin, { orderId: String(pay.order_id), paymentId: String(pay.id), outcome: "failed", reason: pay.error_description });
          outcome = r.changed ? "marked_failed" : "no_change"; paymentRowId = r.payment?.id ?? null;
          if (!r.payment) { const c = await applyCreditOutcome(supabaseAdmin, { orderId: String(pay.order_id), paymentId: String(pay.id), outcome: "failed", reason: pay.error_description }); if (c.found) outcome = c.changed ? "credit_order_failed" : "credits_no_change"; }
        } else if ((type === "refund.processed" || type === "refund.failed") && evt.payload?.refund?.entity?.id) {
          const ref0 = evt.payload.refund.entity;
          const { data: cr } = await supabaseAdmin.from("credit_refunds").select("id").eq("provider_refund_id", String(ref0.id)).maybeSingle();
          if (cr) {
            const { data: ok } = await supabaseAdmin.rpc("settle_credit_refund", { _refund: cr.id, _status: type === "refund.processed" ? "processed" : "failed", _provider_refund_id: String(ref0.id), _reason: "Reported by Razorpay webhook" });
            outcome = ok ? "credit_refund_settled" : "no_change";
          } else if (type === "refund.processed" && ref0.payment_id) {
            outcome = (await applyRefund(supabaseAdmin, { providerPaymentId: String(ref0.payment_id), refundId: String(ref0.id), amountPaise: Number(ref0.amount) || 0 })) ? "refund_recorded" : "no_change";
          }
        } else if (false) {
          const ref = evt.payload?.refund?.entity;
          if (ref?.payment_id) outcome = (await applyRefund(supabaseAdmin, { providerPaymentId: String(ref.payment_id), refundId: String(ref.id), amountPaise: Number(ref.amount) || 0 })) ? "refund_recorded" : "no_change";
        }
        await supabaseAdmin.from("payment_events").update({ outcome, payment_id: paymentRowId }).eq("provider_event_id", eventId.slice(0, 120));
        return Response.json({ ok: true });
      },
    },
  },
});
