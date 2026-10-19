import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canPay, computeFees, refundableRemaining } from "./fees";

const paise = z.number().int().min(0).max(100_000_000);

async function loadFeeModel(sb: { from: (t: "platform_settings") => any }) {
  const { data } = await sb.from("platform_settings").select("value").eq("key", "fee_model").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, unknown>;
  return {
    defaultPlatformFee: Number(v.default_platform_fee_paise ?? 0),
    gst: Number(v.platform_gst_percent ?? 18),
    refundWindowDays: Number(v.refund_window_days ?? 7),
  };
}

/** Professional (accepted assignment) or staff raises an itemised payment request for a service request. */
export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    requestId: z.string().uuid(), description: z.string().trim().min(3).max(200),
    professionalFeePaise: paise, professionalTaxPaise: paise, governmentFeePaise: paise, taxNote: z.string().trim().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req } = await supabase.from("service_requests").select("id,customer_id,assigned_professional_id,assignment_accepted_at,service_slug,status").eq("id", data.requestId).maybeSingle();
    if (!req) throw new Error("Request not found");
    const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
    const isPro = req.assigned_professional_id === userId && !!req.assignment_accepted_at;
    if (!staff && !isPro) throw new Error("Only the accepted professional or LegalSetu staff can request payment");
    if (["cancelled", "closed"].includes(req.status)) throw new Error("This request is no longer active");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const model = await loadFeeModel(supabaseAdmin);
    const { data: fee } = await supabaseAdmin.from("platform_fees").select("fee_paise").eq("service_slug", req.service_slug).maybeSingle();
    const f = computeFees({ professionalFeePaise: data.professionalFeePaise, professionalTaxPaise: data.professionalTaxPaise, governmentFeePaise: data.governmentFeePaise, platformFeePaise: fee?.fee_paise ?? model.defaultPlatformFee, platformGstPercent: model.gst });
    if (f.total_paise <= 0) throw new Error("Total must be more than zero");
    const { data: p, error } = await supabaseAdmin.from("payments").insert({
      request_id: req.id, customer_id: req.customer_id, professional_id: req.assigned_professional_id, description: `[TEST MODE] ${data.description}`,
      ...f, tax_note: data.taxNote || `Platform fee GST ${model.gst}%. Professional tax as declared by the professional.`, status: "pending", test_mode: true, created_by: userId,
    }).select("id").single();
    if (error) { console.error(error); throw new Error("Couldn't create payment request"); }
    return { id: p.id };
  });

/** Customer confirms the amount; server creates a Razorpay TEST order. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid(), confirmed: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("payments").select("*").eq("id", data.paymentId).maybeSingle();
    if (!p || p.customer_id !== context.userId) throw new Error("Payment not found");
    if (!canPay(p.status)) throw new Error("This payment can't be started again");
    const { razorpayApi, razorpayConfig } = await import("./razorpay.server");
    const { keyId } = razorpayConfig();
    const order = await razorpayApi<{ id: string; amount: number; currency: string }>("/orders", { method: "POST", body: { amount: p.total_paise, currency: "INR", receipt: p.id.slice(0, 40), notes: { payment_id: p.id, mode: "TEST" } } });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").update({ status: "initiated", provider_order_id: order.id, amount_confirmed_at: new Date().toISOString(), failure_reason: null }).eq("id", p.id);
    return { keyId, orderId: order.id, amount: order.amount, currency: order.currency, description: p.description };
  });

/** Browser hands back the checkout result; the server checks the signature AND asks Razorpay for the real status. */
export const verifyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid(), razorpayOrderId: z.string().max(64), razorpayPaymentId: z.string().max(64), razorpaySignature: z.string().max(256) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("payments").select("id,customer_id,provider_order_id").eq("id", data.paymentId).maybeSingle();
    if (!p || p.customer_id !== context.userId || p.provider_order_id !== data.razorpayOrderId) throw new Error("Payment not found");
    const { hmacHex, safeEqual, razorpayConfig, razorpayApi } = await import("./razorpay.server");
    const expected = await hmacHex(razorpayConfig().keySecret, `${data.razorpayOrderId}|${data.razorpayPaymentId}`);
    if (!safeEqual(expected, data.razorpaySignature)) return { status: "unverified" };
    const rp = await razorpayApi<{ status: string; order_id: string; error_description?: string }>(`/payments/${encodeURIComponent(data.razorpayPaymentId)}`);
    if (rp.order_id !== data.razorpayOrderId) return { status: "unverified" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyPaymentOutcome } = await import("./payments.server");
    if (rp.status === "captured" || rp.status === "authorized") {
      const r = await applyPaymentOutcome(supabaseAdmin, { orderId: data.razorpayOrderId, paymentId: data.razorpayPaymentId, outcome: "successful" });
      return { status: r.payment?.status ?? "successful" };
    }
    if (rp.status === "failed") {
      await applyPaymentOutcome(supabaseAdmin, { orderId: data.razorpayOrderId, paymentId: data.razorpayPaymentId, outcome: "failed", reason: rp.error_description });
      return { status: "failed" };
    }
    return { status: "initiated" };
  });

/** Customer closed the checkout. Only an unpaid, initiated payment can be marked cancelled; a later provider success still wins. */
export const cancelCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("payments").select("id,customer_id,status,provider_order_id").eq("id", data.paymentId).maybeSingle();
    if (!p || p.customer_id !== context.userId) throw new Error("Payment not found");
    if (p.status !== "initiated") return { status: p.status };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ask Razorpay (server-side) what actually happened on this order before closing it.
    if (p.provider_order_id) {
      const { razorpayApi } = await import("./razorpay.server");
      const { applyPaymentOutcome } = await import("./payments.server");
      const res = await razorpayApi<{ items: { id: string; status: string; error_description?: string }[] }>(`/orders/${encodeURIComponent(p.provider_order_id)}/payments`).catch(() => ({ items: [] }));
      const ok = res.items.find((x) => x.status === "captured" || x.status === "authorized");
      if (ok) { await applyPaymentOutcome(supabaseAdmin, { orderId: p.provider_order_id, paymentId: ok.id, outcome: "successful" }); return { status: "successful" }; }
      const failed = res.items.find((x) => x.status === "failed");
      if (failed) { await applyPaymentOutcome(supabaseAdmin, { orderId: p.provider_order_id, paymentId: failed.id, outcome: "failed", reason: failed.error_description }); return { status: "failed" }; }
    }
    await supabaseAdmin.from("payments").update({ status: "cancelled" }).eq("id", p.id).eq("status", "initiated");
    return { status: "cancelled" };
  });

export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid(), amountPaise: z.number().int().min(1), reason: z.string().trim().min(10).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("payments").select("*").eq("id", data.paymentId).maybeSingle();
    if (!p || p.customer_id !== context.userId) throw new Error("Payment not found");
    if (!["successful", "partially_refunded"].includes(p.status)) throw new Error("Refunds can only be requested for completed payments");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const model = await loadFeeModel(supabaseAdmin);
    if (p.paid_at && Date.now() - new Date(p.paid_at).getTime() > model.refundWindowDays * 864e5) throw new Error(`Refund requests must be made within ${model.refundWindowDays} days of payment. Please contact support.`);
    if (data.amountPaise > refundableRemaining(p)) throw new Error("Amount is more than the refundable balance");
    const { count } = await supabaseAdmin.from("refund_requests").select("id", { count: "exact", head: true }).eq("payment_id", p.id).in("status", ["requested", "approved"]);
    if (count) throw new Error("A refund request is already being reviewed");
    await supabaseAdmin.from("refund_requests").insert({ payment_id: p.id, customer_id: context.userId, amount_paise: data.amountPaise, reason: data.reason });
    await supabaseAdmin.from("payments").update({ status: "refund_requested" }).eq("id", p.id);
    return { ok: true };
  });

/** Admin approves (issues a Razorpay TEST refund) or rejects. */
export const reviewRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ refundId: z.string().uuid(), approve: z.boolean(), note: z.string().trim().min(5).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only administrators can review refunds");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rr } = await supabaseAdmin.from("refund_requests").select("*").eq("id", data.refundId).maybeSingle();
    if (!rr || rr.status !== "requested") throw new Error("This refund has already been reviewed");
    const { data: p } = await supabaseAdmin.from("payments").select("*").eq("id", rr.payment_id).single();
    if (!p) throw new Error("Payment not found");
    const reviewed = { reviewer_id: context.userId, review_note: data.note, reviewed_at: new Date().toISOString() };
    if (!data.approve) {
      await supabaseAdmin.from("refund_requests").update({ ...reviewed, status: "rejected" }).eq("id", rr.id);
      await supabaseAdmin.from("payments").update({ status: p.refunded_paise > 0 ? "partially_refunded" : "successful" }).eq("id", p.id);
      return { status: "rejected" };
    }
    if (!p.provider_payment_id) throw new Error("No provider payment to refund");
    const { razorpayApi } = await import("./razorpay.server");
    const ref = await razorpayApi<{ id: string; amount: number; status: string }>(`/payments/${encodeURIComponent(p.provider_payment_id)}/refund`, { method: "POST", body: { amount: rr.amount_paise, notes: { refund_request: rr.id, mode: "TEST" } } });
    await supabaseAdmin.from("refund_requests").update({ ...reviewed, status: "approved", provider_refund_id: ref.id }).eq("id", rr.id);
    if (ref.status === "processed") {
      const { applyRefund } = await import("./payments.server");
      await applyRefund(supabaseAdmin, { providerPaymentId: p.provider_payment_id, refundId: ref.id, amountPaise: ref.amount });
    }
    return { status: "approved" };
  });

/** Admin re-checks an approved refund with Razorpay (server-side) and records it once processed.
 * Used when the refund webhook has not arrived yet. */
export const syncRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ refundId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only administrators can sync refunds");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rr } = await supabaseAdmin.from("refund_requests").select("*").eq("id", data.refundId).maybeSingle();
    if (!rr?.provider_refund_id || rr.status !== "approved") throw new Error("Nothing to sync for this refund");
    const { razorpayApi } = await import("./razorpay.server");
    const ref = await razorpayApi<{ id: string; amount: number; status: string; payment_id: string }>(`/refunds/${encodeURIComponent(rr.provider_refund_id)}`);
    if (ref.status !== "processed") return { status: ref.status };
    const { applyRefund } = await import("./payments.server");
    await applyRefund(supabaseAdmin, { providerPaymentId: ref.payment_id, refundId: ref.id, amountPaise: ref.amount });
    return { status: "processed" };
  });
