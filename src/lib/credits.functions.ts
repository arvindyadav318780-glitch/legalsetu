import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { creditsRequired, packPrice, type MarketSettings } from "./marketplace";

/** Professional buys a credit pack (Razorpay TEST only). Blocked until the compliance switch is on. */
export const startCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ credits: z.number().int().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: pro }, { data: s }] = await Promise.all([
      supabase.from("professional_profiles").select("category,verification_status,suspended").eq("user_id", userId).maybeSingle(),
      supabase.from("marketplace_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (!pro || pro.verification_status !== "approved" || pro.suspended) throw new Error("Only verified, active professionals can buy contact credits");
    if (!creditsRequired(pro.category, s as MarketSettings)) throw new Error("Contact credits are not enabled for your profession (pending legal review)");
    const amount = packPrice(data.credits, s!.contact_price_paise);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("credit_orders").insert({ professional_id: userId, credits: data.credits, amount_paise: amount, status: "pending", test_mode: true }).select("id").single();
    if (error) { console.error(error); throw new Error("Couldn't create the order"); }
    const { razorpayApi, razorpayConfig } = await import("./razorpay.server");
    const { keyId } = razorpayConfig();
    const order = await razorpayApi<{ id: string; amount: number; currency: string }>("/orders", { method: "POST", body: { amount, currency: "INR", receipt: `cr_${row.id.slice(0, 30)}`, notes: { credit_order_id: row.id, mode: "TEST", kind: "contact_credits" } } });
    await supabaseAdmin.from("credit_orders").update({ status: "initiated", provider_order_id: order.id }).eq("id", row.id);
    return { orderRowId: row.id, keyId, orderId: order.id, amount: order.amount, currency: order.currency };
  });

export const verifyCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderRowId: z.string().uuid(), razorpayOrderId: z.string().max(64), razorpayPaymentId: z.string().max(64), razorpaySignature: z.string().max(256) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("credit_orders").select("id,professional_id,provider_order_id").eq("id", data.orderRowId).maybeSingle();
    if (!o || o.professional_id !== context.userId || o.provider_order_id !== data.razorpayOrderId) throw new Error("Order not found");
    const { hmacHex, safeEqual, razorpayConfig, razorpayApi } = await import("./razorpay.server");
    const expected = await hmacHex(razorpayConfig().keySecret, `${data.razorpayOrderId}|${data.razorpayPaymentId}`);
    if (!safeEqual(expected, data.razorpaySignature)) return { status: "unverified" };
    const rp = await razorpayApi<{ status: string; order_id: string; error_description?: string }>(`/payments/${encodeURIComponent(data.razorpayPaymentId)}`);
    if (rp.order_id !== data.razorpayOrderId) return { status: "unverified" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyCreditOutcome } = await import("./payments.server");
    if (rp.status === "captured" || rp.status === "authorized") { await applyCreditOutcome(supabaseAdmin, { orderId: data.razorpayOrderId, paymentId: data.razorpayPaymentId, outcome: "successful" }); return { status: "successful" }; }
    if (rp.status === "failed") { await applyCreditOutcome(supabaseAdmin, { orderId: data.razorpayOrderId, paymentId: data.razorpayPaymentId, outcome: "failed", reason: rp.error_description }); return { status: "failed" }; }
    return { status: "initiated" };
  });

export const cancelCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderRowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: o } = await context.supabase.from("credit_orders").select("id,professional_id,status,provider_order_id").eq("id", data.orderRowId).maybeSingle();
    if (!o || o.professional_id !== context.userId) throw new Error("Order not found");
    if (o.status !== "initiated") return { status: o.status };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (o.provider_order_id) {
      const { razorpayApi } = await import("./razorpay.server");
      const { applyCreditOutcome } = await import("./payments.server");
      const res = await razorpayApi<{ items: { id: string; status: string; error_description?: string }[] }>(`/orders/${encodeURIComponent(o.provider_order_id)}/payments`).catch(() => ({ items: [] }));
      const ok = res.items.find((x) => x.status === "captured" || x.status === "authorized");
      if (ok) { await applyCreditOutcome(supabaseAdmin, { orderId: o.provider_order_id, paymentId: ok.id, outcome: "successful" }); return { status: "successful" }; }
      const failed = res.items.find((x) => x.status === "failed");
      if (failed) { await applyCreditOutcome(supabaseAdmin, { orderId: o.provider_order_id, paymentId: failed.id, outcome: "failed", reason: failed.error_description }); return { status: "failed" }; }
    }
    await supabaseAdmin.from("credit_orders").update({ status: "cancelled" }).eq("id", o.id).eq("status", "initiated");
    return { status: "cancelled" };
  });

/** Admin refunds an unused credit pack via Razorpay TEST. Credits are held at once; the refund is final only when Razorpay confirms it. */
export const refundCreditPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), note: z.string().trim().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rid, error } = await context.supabase.rpc("start_credit_refund", { _order: data.orderId, _note: data.note });
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("credit_orders").select("provider_payment_id,amount_paise").eq("id", data.orderId).single();
    const { razorpayApi } = await import("./razorpay.server");
    try {
      const rf = await razorpayApi<{ id: string; status: string }>(`/payments/${encodeURIComponent(o!.provider_payment_id!)}/refund`, { method: "POST", body: { amount: o!.amount_paise, notes: { credit_refund_id: rid, mode: "TEST" } } });
      await supabaseAdmin.from("credit_refunds").update({ provider_refund_id: rf.id }).eq("id", rid as string);
      if (rf.status === "processed") await supabaseAdmin.rpc("settle_credit_refund", { _refund: rid as string, _status: "processed", _provider_refund_id: rf.id, _reason: "" });
      if (rf.status === "failed") await supabaseAdmin.rpc("settle_credit_refund", { _refund: rid as string, _status: "failed", _provider_refund_id: rf.id, _reason: "Razorpay reported failure" });
      return { status: rf.status === "processed" ? "processed" : rf.status === "failed" ? "failed" : "pending" };
    } catch (e) {
      // Provider rejected the refund request: release the held credits.
      await supabaseAdmin.rpc("settle_credit_refund", { _refund: rid as string, _status: "failed", _provider_refund_id: "", _reason: e instanceof Error ? e.message : "Refund request failed" });
      return { status: "failed" };
    }
  });

/** Admin asks Razorpay for the real refund status. */
export const syncCreditRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ refundId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("credit_refunds").select("*").eq("id", data.refundId).maybeSingle();
    if (!r?.provider_refund_id) throw new Error("No Razorpay refund reference yet");
    if (r.status !== "pending") return { status: r.status };
    const { razorpayApi } = await import("./razorpay.server");
    const rf = await razorpayApi<{ status: string }>(`/refunds/${encodeURIComponent(r.provider_refund_id)}`);
    if (rf.status === "processed" || rf.status === "failed") {
      await supabaseAdmin.rpc("settle_credit_refund", { _refund: r.id, _status: rf.status, _provider_refund_id: r.provider_refund_id, _reason: "Reported by Razorpay" });
    }
    return { status: rf.status };
  });
